import { createServerFn } from "@tanstack/react-start"
import { AppwriteException } from "node-appwrite"
import { z } from "zod"
import { MAX_STRIKES } from "@/lib/game"
import { NAME_MAX, NAME_MIN, cleanName, guestName } from "@/lib/players"
import { appwrite, asUser } from "./appwrite"
import { dayStats, listResults, loadGame, missedGuesses, moveGames, saveGame, setPlayerName } from "./games"
import { loadCustom } from "./custom"
import { loadPuzzle } from "./puzzles"
import { currentSession, ensureSession, forget, isAdmin, remember, requireAdmin, type User } from "./session"

const ref = z.object({ kind: z.enum(["daily", "custom"]), id: z.string().regex(/^[a-z0-9-]{1,20}$/) })
const name = z.string().transform(cleanName).pipe(z.string().min(NAME_MIN).max(NAME_MAX))
const state = z.object({
  found: z.array(z.number().int()).max(8),
  guesses: z.array(z.object({ text: z.string().max(40), result: z.enum(["hit", "miss"]), index: z.number().int().optional() })).max(8 + MAX_STRIKES + 20),
  strikes: z.number().int(),
  status: z.enum(["playing", "won", "lost"]),
  hints: z.array(z.number().int()).max(8).optional(),
  clues: z.array(z.number().int()).max(8).optional(),
})

export type AccountUser = { id: string; name: string; named: boolean; email: string | null; guest: boolean; admin: boolean }

function describe(user: User): AccountUser {
  return { id: user.$id, name: user.name || guestName(user.$id), named: !!user.name, email: user.email || null, guest: !user.email, admin: isAdmin(user) }
}

function failure(error: unknown, messages: Record<string, string>, fallback: string): { ok: false; error: string } {
  if (error instanceof AppwriteException && error.type in messages) return { ok: false, error: messages[error.type] }
  console.error(error)
  return { ok: false, error: fallback }
}

export const getAccount = createServerFn({ method: "GET" }).handler(async () => {
  if (!appwrite()) return { enabled: false, user: null as AccountUser | null }
  const session = await currentSession()
  return { enabled: true, user: session ? describe(session.user) : null }
})

export const signUp = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.email().max(200), password: z.string().min(8).max(256), name: name.optional() }))
  .handler(async ({ data }) => {
    const { user, secret } = await ensureSession()
    if (user.email) return { ok: false as const, error: "Už jste přihlášeni k účtu." }
    const account = asUser(secret)!.account
    try {
      await account.updateEmail({ email: data.email, password: data.password })
      if (data.name) {
        await account.updateName({ name: data.name })
        await setPlayerName(user.$id, data.name)
      }
      return { ok: true as const }
    } catch (error) {
      return failure(
        error,
        {
          user_target_already_exists: "Tenhle e-mail už má účet. Přihlaste se.",
          user_email_already_exists: "Tenhle e-mail už má účet. Přihlaste se.",
          user_already_exists: "Tenhle e-mail už má účet. Přihlaste se.",
          password_personal_data: "Heslo nesmí obsahovat vaše jméno ani e-mail.",
          password_recently_used: "Tohle heslo se objevilo v únicích dat. Zvolte jiné.",
          general_argument_invalid: "Zkontrolujte e-mail a heslo (aspoň 8 znaků).",
        },
        "Účet se nepodařilo založit. Zkuste to prosím znovu.",
      )
    }
  })

export const signIn = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.email().max(200), password: z.string().min(1).max(256) }))
  .handler(async ({ data }) => {
    const admin = appwrite()
    if (!admin) return { ok: false as const, error: "Účty teď nejsou k dispozici." }
    try {
      const previous = await currentSession()
      const session = await admin.account.createEmailPasswordSession({ email: data.email, password: data.password })
      if (previous && previous.user.$id !== session.userId) {
        if (!previous.user.email) await moveGames(previous.user.$id, session.userId)
        await asUser(previous.secret)!.account.deleteSession({ sessionId: "current" }).catch(() => undefined)
      }
      remember(session.secret)
      return { ok: true as const }
    } catch (error) {
      return failure(
        error,
        { user_invalid_credentials: "Špatný e-mail nebo heslo.", user_blocked: "Tenhle účet je zablokovaný.", general_rate_limit_exceeded: "Moc pokusů. Zkuste to za chvíli." },
        "Přihlášení se nepovedlo. Zkuste to prosím znovu.",
      )
    }
  })

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const session = await currentSession()
  if (session) await asUser(session.secret)!.account.deleteSession({ sessionId: "current" }).catch(() => undefined)
  forget()
  return { ok: true }
})

export const setName = createServerFn({ method: "POST" })
  .validator(z.object({ name }))
  .handler(async ({ data }) => {
    const { user, secret } = await ensureSession()
    await asUser(secret)!.account.updateName({ name: data.name })
    await setPlayerName(user.$id, data.name)
    return { ok: true }
  })

export const getMyGame = createServerFn({ method: "GET" })
  .validator(ref)
  .handler(async ({ data }) => {
    const session = await currentSession()
    return session ? loadGame(session.user.$id, data) : null
  })

export const saveMyGame = createServerFn({ method: "POST" })
  .validator(z.object({ ref, board: z.string().max(600), state, daily: z.boolean() }))
  .handler(async ({ data }) => {
    const { user } = await ensureSession()
    return { state: await saveGame(user.$id, data.ref, data.board, data.state, data.daily) }
  })

export const getMyResults = createServerFn({ method: "GET" }).handler(async () => {
  const session = await currentSession()
  return session ? listResults(session.user.$id) : null
})

async function answerCount(data: z.infer<typeof ref>): Promise<number | null> {
  const puzzle = data.kind === "custom" ? await loadCustom(data.id) : await loadPuzzle(data.id)
  return puzzle ? puzzle.answers.length : null
}

export const getDayStats = createServerFn({ method: "GET" })
  .validator(ref)
  .handler(async ({ data }) => {
    const count = await answerCount(data)
    if (count === null || !appwrite()) return null
    const session = await currentSession()
    return dayStats(data, count, session?.user.$id ?? null)
  })

export const getMissedGuesses = createServerFn({ method: "GET" })
  .validator(ref)
  .handler(async ({ data }) => {
    await requireAdmin()
    return missedGuesses(data)
  })
