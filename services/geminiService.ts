import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Question, QuestionType } from "../types";

const getAI = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- Question Generation ---

export const generateExamQuestions = async (topic: string, count: number): Promise<Question[]> => {
  const ai = getAI();
  
  const prompt = `Generate ${count} exam questions about "${topic}".
  Mix Multiple Choice (MCQ) and Short Answer questions.
  For MCQs, provide 4 options and the correct answer.
  For Short Answer, provide a "model answer" for grading purposes.
  Assign 5-10 points based on difficulty.`;

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        type: { type: Type.STRING, enum: ["MCQ", "SHORT_ANSWER"] },
        options: { type: Type.ARRAY, items: { type: Type.STRING } },
        correctAnswer: { type: Type.STRING },
        modelAnswer: { type: Type.STRING },
        points: { type: Type.NUMBER }
      },
      required: ["text", "type", "points"]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        systemInstruction: "You are a strict academic professor creating exam questions."
      }
    });

    const rawQuestions = JSON.parse(response.text || '[]');
    
    // Map to our internal type
    return rawQuestions.map((q: any, idx: number) => ({
      id: `gen_${Date.now()}_${idx}`,
      text: q.text,
      type: q.type === 'MCQ' ? QuestionType.MCQ : QuestionType.SHORT_ANSWER,
      options: q.options || [],
      // Use nullish coalescing to avoid undefined values which break Firestore
      correctAnswer: q.correctAnswer || null,
      modelAnswer: q.modelAnswer || q.correctAnswer || null,
      points: q.points
    }));
  } catch (error) {
    console.error("Gemini Generation Error", error);
    return [];
  }
};

// --- Auto Grading ---

interface GradeResult {
  score: number;
  feedback: string;
}

export const gradeShortAnswer = async (question: string, studentAnswer: string, modelAnswer: string, maxPoints: number): Promise<GradeResult> => {
  const ai = getAI();

  const prompt = `
  Question: "${question}"
  Student Answer: "${studentAnswer}"
  Model Answer: "${modelAnswer}"
  Max Points: ${maxPoints}

  Task: specific score (0 to ${maxPoints}) and brief feedback.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.NUMBER },
      feedback: { type: Type.STRING }
    },
    required: ["score", "feedback"]
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        systemInstruction: "You are an AI grader. Be fair but strict. Partial credit is allowed."
      }
    });

    return JSON.parse(response.text || '{"score": 0, "feedback": "Error grading"}');
  } catch (error) {
    return { score: 0, feedback: "AI Grading failed. Manual review required." };
  }
};