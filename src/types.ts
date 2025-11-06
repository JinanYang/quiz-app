export interface QuestionOption {
  label: string
  text: string
}

export interface QuestionAnswer {
  label: string
  text: string
}

export interface QuestionItem {
  id: number
  question: string
  score: number | null
  options: QuestionOption[]
  answer: QuestionAnswer
}

export interface UserAnswer {
  choice: string | null
  correct: boolean | null
}
