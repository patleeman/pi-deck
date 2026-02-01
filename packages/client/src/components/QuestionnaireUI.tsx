import { useState, useCallback } from 'react';
import type { QuestionnaireQuestion, QuestionnaireAnswer } from '@pi-web-ui/shared';

interface QuestionnaireUIProps {
  questions: QuestionnaireQuestion[];
  onSubmit: (answers: QuestionnaireAnswer[], cancelled: boolean) => void;
}

export function QuestionnaireUI({ questions, onSubmit }: QuestionnaireUIProps) {
  const isMulti = questions.length > 1;
  const [currentTab, setCurrentTab] = useState(0);
  const [answers, setAnswers] = useState<Map<string, QuestionnaireAnswer>>(new Map());
  const [customInputs, setCustomInputs] = useState<Map<string, string>>(new Map());
  const [showingCustomInput, setShowingCustomInput] = useState<string | null>(null);

  const normalizedQuestions = questions.map((q, i) => ({
    ...q,
    label: q.label || `Q${i + 1}`,
    allowOther: q.allowOther !== false,
  }));

  const currentQuestion = normalizedQuestions[currentTab];
  const allAnswered = normalizedQuestions.every((q) => answers.has(q.id));

  const selectOption = useCallback((questionId: string, option: { value: string; label: string }, index: number) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(questionId, {
        id: questionId,
        value: option.value,
        label: option.label,
        wasCustom: false,
        index: index + 1,
      });
      return next;
    });
    
    // Auto-advance for single question
    if (!isMulti) {
      // Submit immediately for single question
      const answer: QuestionnaireAnswer = {
        id: questionId,
        value: option.value,
        label: option.label,
        wasCustom: false,
        index: index + 1,
      };
      onSubmit([answer], false);
    } else if (currentTab < questions.length - 1) {
      // Move to next question
      setCurrentTab((prev) => prev + 1);
    } else {
      // Move to submit tab
      setCurrentTab(questions.length);
    }
  }, [isMulti, currentTab, questions.length, onSubmit]);

  const submitCustomInput = useCallback((questionId: string) => {
    const value = customInputs.get(questionId)?.trim() || '(no response)';
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(questionId, {
        id: questionId,
        value,
        label: value,
        wasCustom: true,
      });
      return next;
    });
    setShowingCustomInput(null);
    setCustomInputs((prev) => {
      const next = new Map(prev);
      next.delete(questionId);
      return next;
    });

    // Auto-advance
    if (!isMulti) {
      const answer: QuestionnaireAnswer = {
        id: questionId,
        value,
        label: value,
        wasCustom: true,
      };
      onSubmit([answer], false);
    } else if (currentTab < questions.length - 1) {
      setCurrentTab((prev) => prev + 1);
    } else {
      setCurrentTab(questions.length);
    }
  }, [customInputs, isMulti, currentTab, questions.length, onSubmit]);

  const handleSubmit = useCallback(() => {
    if (allAnswered) {
      onSubmit(Array.from(answers.values()), false);
    }
  }, [allAnswered, answers, onSubmit]);

  const handleCancel = useCallback(() => {
    onSubmit([], true);
  }, [onSubmit]);

  // Render options for current question
  const renderOptions = () => {
    if (!currentQuestion) return null;
    
    const options = [...currentQuestion.options];
    if (currentQuestion.allowOther) {
      options.push({ value: '__other__', label: 'Type something...', description: undefined });
    }

    return (
      <div className="space-y-1">
        {options.map((opt, i) => {
          const isOther = opt.value === '__other__';
          const isSelected = answers.get(currentQuestion.id)?.value === opt.value;
          
          return (
            <button
              key={opt.value}
              onClick={() => {
                if (isOther) {
                  setShowingCustomInput(currentQuestion.id);
                } else {
                  selectOption(currentQuestion.id, opt, i);
                }
              }}
              className={`w-full text-left px-2 py-1.5 rounded border transition-colors ${
                isSelected
                  ? 'border-pi-accent bg-pi-accent/10 text-pi-accent'
                  : 'border-pi-border hover:border-pi-accent/50 text-pi-text'
              }`}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-pi-muted text-xs">{i + 1}.</span>
                <div className="flex-1">
                  <div className={isOther ? 'text-pi-muted italic' : ''}>{opt.label}</div>
                  {opt.description && (
                    <div className="text-xs text-pi-muted mt-0.5">{opt.description}</div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  // Render custom input
  const renderCustomInput = () => {
    if (!currentQuestion || showingCustomInput !== currentQuestion.id) return null;

    return (
      <div className="mt-2 space-y-2">
        <textarea
          autoFocus
          value={customInputs.get(currentQuestion.id) || ''}
          onChange={(e) => {
            setCustomInputs((prev) => {
              const next = new Map(prev);
              next.set(currentQuestion.id, e.target.value);
              return next;
            });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submitCustomInput(currentQuestion.id);
            } else if (e.key === 'Escape') {
              setShowingCustomInput(null);
            }
          }}
          placeholder="Type your answer..."
          className="w-full px-2 py-1.5 bg-pi-bg border border-pi-accent rounded text-pi-text text-sm resize-none focus:outline-none"
          rows={2}
        />
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => submitCustomInput(currentQuestion.id)}
            className="px-2 py-1 bg-pi-accent text-pi-bg rounded hover:opacity-80"
          >
            Submit
          </button>
          <button
            onClick={() => setShowingCustomInput(null)}
            className="px-2 py-1 text-pi-muted hover:text-pi-text"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  // Render tab bar for multi-question
  const renderTabBar = () => {
    if (!isMulti) return null;

    return (
      <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
        {normalizedQuestions.map((q, i) => {
          const isActive = i === currentTab;
          const isAnswered = answers.has(q.id);
          
          return (
            <button
              key={q.id}
              onClick={() => setCurrentTab(i)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-pi-accent/20 text-pi-text'
                  : isAnswered
                  ? 'text-pi-success hover:bg-pi-surface'
                  : 'text-pi-muted hover:bg-pi-surface'
              }`}
            >
              <span>{isAnswered ? '■' : '□'}</span>
              <span>{q.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setCurrentTab(questions.length)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap transition-colors ${
            currentTab === questions.length
              ? 'bg-pi-accent/20 text-pi-text'
              : allAnswered
              ? 'text-pi-success hover:bg-pi-surface'
              : 'text-pi-muted hover:bg-pi-surface'
          }`}
        >
          <span>✓</span>
          <span>Submit</span>
        </button>
      </div>
    );
  };

  // Render submit view
  const renderSubmitView = () => {
    return (
      <div className="space-y-3">
        <div className="font-medium text-pi-accent">Review your answers</div>
        <div className="space-y-1 text-sm">
          {normalizedQuestions.map((q) => {
            const answer = answers.get(q.id);
            return (
              <div key={q.id} className="flex gap-2">
                <span className="text-pi-muted">{q.label}:</span>
                {answer ? (
                  <span className="text-pi-text">
                    {answer.wasCustom ? '(wrote) ' : ''}
                    {answer.label}
                  </span>
                ) : (
                  <span className="text-pi-warning">(unanswered)</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              allAnswered
                ? 'bg-pi-success text-pi-bg hover:opacity-80'
                : 'bg-pi-muted/20 text-pi-muted cursor-not-allowed'
            }`}
          >
            Submit Answers
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 text-sm text-pi-muted hover:text-pi-text"
          >
            Cancel
          </button>
        </div>
        {!allAnswered && (
          <div className="text-xs text-pi-warning">
            Please answer all questions before submitting
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="font-mono text-xs md:text-sm border border-pi-accent/50 rounded-lg p-3 bg-pi-surface/50">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 text-pi-accent">
        <span className="text-lg">?</span>
        <span className="font-medium">Questionnaire</span>
        <span className="text-pi-muted text-xs">
          ({questions.length} question{questions.length !== 1 ? 's' : ''})
        </span>
      </div>

      {/* Tab bar for multi-question */}
      {renderTabBar()}

      {/* Content */}
      {currentTab < questions.length ? (
        <div className="space-y-3">
          {/* Question prompt */}
          <div className="text-pi-text">{currentQuestion?.prompt}</div>

          {/* Options or custom input */}
          {showingCustomInput === currentQuestion?.id ? renderCustomInput() : renderOptions()}

          {/* Help text */}
          <div className="text-xs text-pi-muted pt-2 border-t border-pi-border">
            {isMulti
              ? 'Click tabs to navigate • Select an option or type custom answer'
              : 'Select an option or type a custom answer'}
          </div>
        </div>
      ) : (
        renderSubmitView()
      )}

      {/* Cancel button (always visible) */}
      {currentTab < questions.length && (
        <div className="mt-3 pt-2 border-t border-pi-border">
          <button
            onClick={handleCancel}
            className="text-xs text-pi-muted hover:text-pi-error"
          >
            Cancel questionnaire
          </button>
        </div>
      )}
    </div>
  );
}
