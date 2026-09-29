import QuizRunner from "@/components/QuizRunner";

const QUIZ = {
  id: "page-demo-quiz",
  title: "Terminal fundamentals",
  kind: "quiz" as const,
  instructions: "Five quick questions on first-year terminal basics.",
  createdBy: "",
  visibleTo: ["student" as const],
  questions: [
    {
      kind: "mcq" as const,
      id: "q1",
      prompt: "Which command changes directories?",
      options: [
        { id: "a", text: "cd" },
        { id: "b", text: "ls" },
        { id: "c", text: "pwd" },
        { id: "d", text: "mv" },
      ],
      correctOptionId: "a",
      marks: 2,
    },
    {
      kind: "mcq" as const,
      id: "q2",
      prompt: "What does rm -r do?",
      options: [
        { id: "a", text: "Renames a file" },
        { id: "b", text: "Removes a directory recursively" },
        { id: "c", text: "Reads a file" },
        { id: "d", text: "Restores a file" },
      ],
      correctOptionId: "b",
      marks: 2,
    },
    {
      kind: "short" as const,
      id: "q3",
      prompt: "Which command shows the first 10 lines of a file?",
      acceptedAnswers: ["head"],
      marks: 2,
    },
  ],
};

export default function QuizPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <QuizRunner quiz={QUIZ} />
    </main>
  );
}
