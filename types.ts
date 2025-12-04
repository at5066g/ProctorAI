export enum UserRole {
  STUDENT = 'STUDENT',
  INSTRUCTOR = 'INSTRUCTOR',
  ADMIN = 'ADMIN'
}

export enum QuestionType {
  MCQ = 'MCQ',
  SHORT_ANSWER = 'SHORT_ANSWER'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[]; // For MCQ
  correctAnswer?: string; // For MCQ auto-grading
  modelAnswer?: string; // For AI grading guidance
  points: number;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  instructorId: string;
  questions: Question[];
  createdAt: string;
  isPublished: boolean;
}

export interface Answer {
  questionId: string;
  response: string;
}

export interface Violation {
  timestamp: number;
  type: 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'NO_FACE';
  message: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  startTime: number;
  endTime?: number;
  answers: Answer[];
  violations: Violation[];
  score?: number;
  feedback?: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
}

// Gemini Types
export interface GemQuestion {
  question: string;
  type: string;
  options: string[];
  answer: string;
}
