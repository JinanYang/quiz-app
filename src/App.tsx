import { useEffect, useMemo, useState } from 'react'
import './App.css'
import type { QuestionItem, UserAnswer } from './types'

type ViewMode = 'all' | 'wrong'

const STORAGE_KEY = 'quiz_user_answers'
const getDataUrl = () => `${import.meta.env.BASE_URL}data/m5_quiz.json`

const getInitialAnswers = (size: number): UserAnswer[] =>
  Array.from({ length: size }, () => ({ choice: null, correct: null }))

const saveAnswersToStorage = (answers: UserAnswer[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answers))
  } catch (err) {
    console.error('保存答题记录失败:', err)
  }
}

const loadAnswersFromStorage = (size: number): UserAnswer[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as UserAnswer[]
      // 确保长度匹配，如果题库更新了则扩展
      if (parsed.length === size) {
        return parsed
      }
      if (parsed.length < size) {
        // 新增题目，补充空答案
        return [...parsed, ...getInitialAnswers(size - parsed.length)]
      }
      // 题库减少，截断
      return parsed.slice(0, size)
    }
  } catch (err) {
    console.error('加载答题记录失败:', err)
  }
  return getInitialAnswers(size)
}

function App() {
  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    const fetchQuestions = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(getDataUrl(), {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`加载题库失败：${response.statusText}`)
        }
        const data = (await response.json()) as QuestionItem[]
        setQuestions(data)
        // 从localStorage读取之前保存的答题记录，如果没有则初始化
        const savedAnswers = loadAnswersFromStorage(data.length)
        setUserAnswers(savedAnswers)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        setError(err instanceof Error ? err.message : '加载题库时出错')
      } finally {
        setLoading(false)
      }
    }

    fetchQuestions()

    return () => controller.abort()
  }, [])

  // 自动保存答题记录到localStorage
  useEffect(() => {
    if (userAnswers.length > 0) {
      saveAnswersToStorage(userAnswers)
    }
  }, [userAnswers])

  const totalQuestions = questions.length
  const currentQuestion = questions[currentIndex]
  const currentAnswer = userAnswers[currentIndex]

  const summary = useMemo(() => {
    const answeredCount = userAnswers.filter(
      (item) => item && item.correct !== null
    ).length
    const correctCount = userAnswers.filter((item) => item?.correct).length
    const wrongCount = userAnswers.filter(
      (item) => item?.correct === false
    ).length
    const totalScore = userAnswers.reduce((acc, answer, index) => {
      if (answer?.correct) {
        const score = questions[index]?.score ?? 0
        return acc + score
      }
      return acc
    }, 0)
    const fullScore = questions.reduce(
      (acc, question) => acc + (question.score ?? 0),
      0
    )
    return { answeredCount, correctCount, wrongCount, totalScore, fullScore }
  }, [userAnswers, questions])

  const wrongQuestionIndices = useMemo(() => {
    return userAnswers.reduce<number[]>((list, answer, index) => {
      if (answer?.correct === false) {
        list.push(index)
      }
      return list
    }, [])
  }, [userAnswers])

  const searchResultIndices = useMemo(() => {
    if (!searchQuery.trim()) {
      return questions.map((_, index) => index)
    }
    const query = searchQuery.toLowerCase()
    return questions.reduce<number[]>((list, question, index) => {
      const questionText = question.question.toLowerCase()
      const optionsText = question.options
        .map((opt) => opt.text.toLowerCase())
        .join(' ')
      if (questionText.includes(query) || optionsText.includes(query)) {
        list.push(index)
      }
      return list
    }, [])
  }, [searchQuery, questions])

  const visibleIndices = useMemo(() => {
    let indices: number[] = []

    // Start with wrong mode or all mode
    if (viewMode === 'wrong') {
      indices = wrongQuestionIndices
    } else {
      indices = searchQuery.trim() ? searchResultIndices : questions.map((_, i) => i)
    }

    // Apply search filter if there's a search query
    if (searchQuery.trim()) {
      indices = indices.filter((idx) => searchResultIndices.includes(idx))
    }

    return indices
  }, [viewMode, wrongQuestionIndices, searchResultIndices, searchQuery, questions])

  useEffect(() => {
    if (viewMode !== 'wrong') {
      return
    }
    if (wrongQuestionIndices.length === 0) {
      return
    }
    if (!wrongQuestionIndices.includes(currentIndex)) {
      setCurrentIndex(wrongQuestionIndices[0])
    }
  }, [viewMode, wrongQuestionIndices, currentIndex])

  const currentVisiblePosition = useMemo(() => {
    return visibleIndices.indexOf(currentIndex)
  }, [visibleIndices, currentIndex])

  const previousIndex =
    currentVisiblePosition > 0
      ? visibleIndices[currentVisiblePosition - 1]
      : null

  const nextIndex =
    currentVisiblePosition !== -1 &&
    currentVisiblePosition < visibleIndices.length - 1
      ? visibleIndices[currentVisiblePosition + 1]
      : null

  const isSubmitted = Boolean(currentAnswer && currentAnswer.correct !== null)
  const selectedChoice = currentAnswer?.choice ?? null

  const handleSelect = (choice: string) => {
    setUserAnswers((prev) => {
      const next = [...prev]
      next[currentIndex] = {
        choice,
        correct: prev[currentIndex]?.correct ?? null,
      }
      return next
    })
    setStatusMessage(null)
  }

  const handleSubmit = () => {
    if (!currentQuestion) {
      return
    }
    if (!selectedChoice) {
      setStatusMessage('请先选择一个选项')
      return
    }
    setUserAnswers((prev) => {
      const next = [...prev]
      next[currentIndex] = {
        choice: selectedChoice,
        correct: selectedChoice === currentQuestion.answer.label,
      }
      return next
    })
  }

  const handleResetQuestion = () => {
    setUserAnswers((prev) => {
      const next = [...prev]
      next[currentIndex] = { choice: null, correct: null }
      return next
    })
    setStatusMessage(null)
  }

  const handlePrevious = () => {
    if (previousIndex === null) {
      return
    }
    setCurrentIndex(previousIndex)
    setStatusMessage(null)
  }

  const handleNext = () => {
    if (nextIndex === null) {
      return
    }
    setCurrentIndex(nextIndex)
    setStatusMessage(null)
  }

  const handleJump = (index: number) => {
    setCurrentIndex(index)
    setStatusMessage(null)
  }

  const handleToggleView = () => {
    if (viewMode === 'all') {
      setViewMode('wrong')
    } else {
      setViewMode('all')
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setStatusMessage(null)
  }

  const handleClearRecords = () => {
    if (confirm('确定要清除所有答题记录吗？此操作无法撤销。')) {
      try {
        localStorage.removeItem(STORAGE_KEY)
        setUserAnswers(getInitialAnswers(questions.length))
        setStatusMessage(null)
        alert('答题记录已清除')
      } catch (err) {
        console.error('清除记录失败:', err)
      }
    }
  }

  const renderBody = () => {
    if (loading) {
      return <div className="state-card">题库加载中...</div>
    }
    if (error) {
      return <div className="state-card error">加载失败：{error}</div>
    }
    if (viewMode === 'wrong' && wrongQuestionIndices.length === 0) {
      return (
        <div className="state-card">
          暂无错题，答错的题目会自动归档到这里，方便集中复习。
        </div>
      )
    }
    if (visibleIndices.length === 0) {
      return (
        <div className="state-card">
          {searchQuery ? '未找到匹配的题目，请修改搜索条件。' : '暂无题目'}
        </div>
      )
    }
    if (!currentQuestion) {
      return <div className="state-card">暂无题目</div>
    }

    const totalVisible =
      viewMode === 'wrong' ? wrongQuestionIndices.length : totalQuestions

    return (
      <div className="question-card">
        <header className="question-header">
          <div className="question-meta">
            <span className="question-index">
              第 {currentQuestion.id} 题 / 共 {totalVisible}{' '}
              {viewMode === 'wrong' ? '道错题' : '题'}
            </span>
            <div className="meta-tags">
              {viewMode === 'wrong' && (
                <span className="view-tag">错题集</span>
              )}
              {currentQuestion.score !== null && (
                <span className="question-score">
                  {currentQuestion.score} 分
                </span>
              )}
            </div>
          </div>
          <h2>{currentQuestion.question}</h2>
        </header>

        <div className="options-list">
          {currentQuestion.options.map((option) => {
            const isSelected = selectedChoice === option.label
            const isCorrect = isSubmitted
              ? option.label === currentQuestion.answer.label
              : false
            const isWrong =
              isSubmitted &&
              isSelected &&
              option.label !== currentQuestion.answer.label

            return (
              <button
                key={option.label}
                type="button"
                className={[
                  'option',
                  isSelected ? 'selected' : '',
                  isCorrect ? 'correct' : '',
                  isWrong ? 'wrong' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleSelect(option.label)}
                disabled={isSubmitted}
              >
                <span className="option-label">{option.label}</span>
                <span className="option-text">{option.text}</span>
              </button>
            )
          })}
        </div>

        <div className="actions">
          {!isSubmitted ? (
            <button
              type="button"
              className="primary"
              onClick={handleSubmit}
              disabled={!selectedChoice}
            >
              提交答案
            </button>
          ) : (
            <button type="button" onClick={handleResetQuestion}>
              重做本题
            </button>
          )}

          <div className="nav-buttons">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={previousIndex === null}
            >
              上一题
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={nextIndex === null}
            >
              下一题
            </button>
          </div>
        </div>

        {statusMessage && <div className="hint">{statusMessage}</div>}

        {isSubmitted && currentQuestion && (
          <div
            className={`feedback ${
              currentAnswer?.correct ? 'success' : 'danger'
            }`}
          >
            {currentAnswer?.correct ? (
              '回答正确！'
            ) : (
              <>
                回答错误。正确答案：{currentQuestion.answer.label}.{' '}
                {currentQuestion.answer.text}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  const questionStatus = (answer?: UserAnswer) => {
    if (!answer || answer.correct === null) {
      return 'pending'
    }
    return answer.correct ? 'correct' : 'wrong'
  }

  const navigatorIndices = visibleIndices

  return (
    <div className="app">
      <aside className="sidebar">
        <h1 className="brand">M5 刷题</h1>
        <div className="search-box">
          <input
            type="text"
            placeholder="搜索题目..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={handleClearSearch}
              title="清除搜索"
            >
              ✕
            </button>
          )}
        </div>
        <div className="summary">
          {searchQuery && (
            <p className="search-stat">
              搜索结果：{visibleIndices.length} / {searchResultIndices.length}
            </p>
          )}
          <p>
            已答：{summary.answeredCount} / {totalQuestions}
          </p>
          <p>正确：{summary.correctCount}</p>
          <p>错题：{summary.wrongCount}</p>
          <p>
            得分：{summary.totalScore}{' '}
            {summary.fullScore ? ` / ${summary.fullScore}` : ''}
          </p>
          <div className="summary-actions">
            <button
              type="button"
              className={viewMode === 'wrong' ? 'active' : ''}
              onClick={handleToggleView}
              disabled={viewMode === 'all' && summary.wrongCount === 0}
            >
              {viewMode === 'wrong' ? '返回全部' : '仅看错题'}
            </button>
            <button
              type="button"
              className="clear-records-btn"
              onClick={handleClearRecords}
              title="清除所有答题记录"
            >
              清除记录
            </button>
          </div>
        </div>
        <div className="question-navigator">
          {navigatorIndices.length === 0 ? (
            <div className="navigator-empty">
              {viewMode === 'wrong' ? '暂无错题' : '暂无题目'}
            </div>
          ) : (
            navigatorIndices.map((index) => {
              const question = questions[index]
              const status = questionStatus(userAnswers[index])
              return (
                <button
                  key={question.id}
                  type="button"
                  className={[
                    'navigator-item',
                    status,
                    index === currentIndex ? 'active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleJump(index)}
                >
                  {question.id}
                </button>
              )
            })
          )}
        </div>
      </aside>
      <main className="main-content">{renderBody()}</main>
    </div>
  )
}

export default App
