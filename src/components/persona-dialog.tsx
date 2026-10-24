import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { modelOf, personaOf } from "@/lib/cast"
import type { PuzzleSecret, Response } from "@/lib/types"

type Props = {
  response: Response | null
  secret?: PuzzleSecret
  onOpenChange: (open: boolean) => void
}

export function PersonaDialog({ response, secret, onOpenChange }: Props) {
  const persona = response ? personaOf(response.persona) : undefined
  const model = response ? modelOf(response.model) : undefined
  const onBoard = response?.answer ? secret?.answers.find((a) => a.text === response.answer) : undefined
  const said = persona?.gender === "f" ? "Odpověděla" : "Odpověděl"

  return (
    <Dialog open={!!response && !!persona} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        {persona && model && (
          <>
            <div className="pr-8">
              <DialogTitle className="head">{persona.name}</DialogTitle>
              <DialogDescription className="mt-2 text-base text-ink">
                {persona.age} let · {persona.town}, {persona.region}
              </DialogDescription>
            </div>
            <p className="font-semibold">{persona.occupation}</p>
            <p>{persona.bio}</p>
            <p className="text-ink-soft">Jak odpovídá: {persona.voice}</p>

            {response?.raw && (
              <div className="bg-paper-step px-4 py-3">
                <p>
                  {said}: <span className="font-semibold">„{response.raw}“</span>
                </p>
                <p className="mt-1 text-ink-soft">
                  {onBoard
                    ? `Na tabuli jako ${onBoard.rank}. ${onBoard.text}.`
                    : response.answer
                      ? `Započteno jako ${response.answer}, mimo tabuli.`
                      : "Odpověď se nedala započítat."}
                </p>
              </div>
            )}

            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-ink-soft">Model</span>
              <span className="font-semibold">{model.name}</span>
              <span className="text-ink-soft">od {model.provider}</span>
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
