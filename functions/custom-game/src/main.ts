import { Client, Storage } from "node-appwrite"
import { InputFile } from "node-appwrite/file"
import { CUSTOM_ID, generateCustomGame } from "../../../pipeline/custom-game.ts"

type Context = {
  req: { bodyText: string; headers: Record<string, string> }
  res: { json: (body: unknown, status?: number) => unknown }
  log: (message: string) => void
  error: (message: string) => void
}

export default async ({ req, res, log, error }: Context) => {
  const { id, question } = JSON.parse(req.bodyText || "{}") as { id?: string; question?: string }
  if (!id || !CUSTOM_ID.test(id) || !question || question.length < 8 || question.length > 90) {
    return res.json({ ok: false, error: "Expected { id, question }" }, 400)
  }

  try {
    const game = await generateCustomGame(id, question, {
      onProgress: (done) => {
        if (done % 25 === 0) log(`${done} answered`)
      },
    })
    const sdk = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT ?? "")
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID ?? "")
      .setKey(req.headers["x-appwrite-key"] ?? "")
    await new Storage(sdk).createFile({
      bucketId: process.env.CUSTOM_GAMES_BUCKET ?? "custom-games",
      fileId: id,
      file: InputFile.fromPlainText(JSON.stringify(game), `${id}.json`),
    })
    log(`saved ${id}: ${game.answers.map((a) => `${a.text} ${a.votes}`).join(", ")} · $${game.meta.costUsd}`)
    return res.json({ ok: true, id })
  } catch (e) {
    error(e instanceof Error ? (e.stack ?? e.message) : String(e))
    return res.json({ ok: false }, 500)
  }
}
