-- Performance Indexes for Fast Exam Result Evaluation
CREATE INDEX IF NOT EXISTS idx_student_answers_session_id ON student_answers (session_id);
CREATE INDEX IF NOT EXISTS idx_question_options_question_correct ON question_options (question_id, is_correct);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_question ON exam_questions (exam_id, question_id);
