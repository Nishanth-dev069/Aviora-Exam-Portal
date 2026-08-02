export interface ComputeResultInput {
  examConfig: {
    marks_per_question: number;
    negative_marks: number;
    passing_marks: number | null;
    total_questions: number;
  };
  examQuestions: {
    question_id: string;
    marks: number;
    content: string;
    content_image_url?: string | null;
    explanation_image_url?: string | null;
    explanation: string;
    options: {
      id: string;
      content: string;
      is_correct: boolean;
    }[];
  }[];
  studentAnswers: {
    question_id: string;
    selected_option_id: string | null;
    time_spent_seconds: number;
  }[];
  sessionData: {
    started_at: string;
    submitted_at: string;
  };
}

export interface ComputedResult {
  total_score: number;
  max_score: number;
  percentage: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  time_taken_seconds: number;
  is_passed: boolean | null;
  result_data: {
    questions: {
      question_id: string;
      question_content: string;
      selected_option_id: string | null;
      selected_option_content: string | null;
      correct_option_id: string;
      correct_option_content: string;
      is_correct: boolean;
      is_unanswered: boolean;
      marks_awarded: number;
      explanation: string;
      time_spent_seconds: number;
    }[];
  };
}

/**
 * Pure, deterministic function to compute exam results.
 * This does not perform any database operations.
 */
export function computeResult(input: ComputeResultInput): ComputedResult {
  const { examConfig, examQuestions, studentAnswers, sessionData } = input;
  
  const answerMap = new Map(studentAnswers.map(a => [a.question_id, a]));
  
  let totalScore = 0;
  const maxScore = examQuestions.reduce((sum, eq) => sum + eq.marks, 0);
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  
  const resultQuestions = examQuestions.map(eq => {
    const correctOption = eq.options.find(o => o.is_correct);
    const studentAnswer = answerMap.get(eq.question_id);
    const selectedOptionId = studentAnswer?.selected_option_id ?? null;
    const selectedOption = eq.options.find(o => o.id === selectedOptionId);
    
    const isUnanswered = selectedOptionId === null;
    const isCorrect = !isUnanswered && selectedOptionId === correctOption?.id;
    
    let marksAwarded = 0;
    if (isUnanswered) {
      unansweredCount++;
    } else if (isCorrect) {
      correctCount++;
      marksAwarded = eq.marks;
      totalScore += marksAwarded;
    } else {
      incorrectCount++;
      marksAwarded = -examConfig.negative_marks;
      totalScore += marksAwarded;
    }
    
    return {
      question_id: eq.question_id,
      question_content: eq.content,
      content_image_url: eq.content_image_url ?? null,
      explanation_image_url: eq.explanation_image_url ?? null,
      selected_option_id: selectedOptionId,
      selected_option_content: selectedOption?.content ?? null,
      correct_option_id: correctOption?.id ?? '',
      correct_option_content: correctOption?.content ?? '',
      is_correct: isCorrect,
      is_unanswered: isUnanswered,
      marks_awarded: marksAwarded,
      explanation: eq.explanation,
      time_spent_seconds: studentAnswer?.time_spent_seconds ?? 0,
    };
  });
  
  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  const isPassed = examConfig.passing_marks !== null ? totalScore >= examConfig.passing_marks : null;
  
  const timeTaken = Math.round(
    (new Date(sessionData.submitted_at).getTime() - new Date(sessionData.started_at).getTime()) / 1000
  );
  
  return {
    total_score: Math.max(0, totalScore), // floor at 0
    max_score: maxScore,
    percentage: Math.round(percentage * 100) / 100,
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    unanswered_count: unansweredCount,
    time_taken_seconds: timeTaken,
    is_passed: isPassed,
    result_data: { questions: resultQuestions },
  };
}
