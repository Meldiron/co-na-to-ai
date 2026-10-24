export type Persona = {
  id: string
  name: string
  age: number
  gender: "f" | "m"
  town: string
  region: string
  occupation: string
  bio: string
  voice: string
}

export type ModelInfo = {
  id: string
  name: string
  provider: string
}

export type Answerer = {
  id: string
  model: string
  persona: string
}

export type Question = {
  id: string
  date?: string
  text: string
  tags: Array<string>
  status: "draft" | "approved" | "used" | "rejected"
}

export type BoardAnswer = {
  rank: number
  text: string
  votes: number
  aliases: Array<string>
  answerers: Array<string>
}

export type OtherAnswer = {
  text: string
  votes: number
  answerers: Array<string>
}

export type Response = {
  answerer: string
  model: string
  persona: string
  raw: string
  answer: string | null
}

export type PuzzleSecret = {
  answers: Array<BoardAnswer>
  others: Array<OtherAnswer>
  responses: Array<Response>
}

export type PuzzleMeta = {
  generatedAt: string
  judgeModel: string
  costUsd: number
  durationMs: number
  failed: number
  clusters: number
  topShare: number
}

export type Puzzle = {
  date: string
  number: number
  questionId: string
  question: string
  asked: number
  answered: number
  meta: PuzzleMeta
} & PuzzleSecret

export type PuzzlePayload = Omit<Puzzle, keyof PuzzleSecret> & {
  kind: "daily" | "custom"
  id: string
  secret: string
}

export type PuzzleSummary = {
  date: string
  number: number
  question: string
}
