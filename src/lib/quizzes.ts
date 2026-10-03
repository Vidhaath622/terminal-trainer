/**
 * Git branching & merging — the ten-question check behind the
 * "Git branching & merging" theory card (src/lib/theory.ts) and the /quiz page.
 *
 * Content mirrors the classroom cheat sheet: the main -> feature -> merge flow,
 * listing / creating / switching branches, merging (including --no-ff and
 * recovering from conflicts), and safe deletion / renaming. Ordered easiest
 * first — Q1-4 easy, Q5-7 medium, Q8-10 hard — and difficulty rides on each
 * question's optional `difficulty` field so QuizRunner can badge it.
 *
 * quizSchema.parse keeps this honest: bad ids, missing options or an answer
 * that doesn't point at an option fail at module load (and in the test).
 */
import { quizSchema, type Quiz } from "@/roles/quiz";

export const GIT_BRANCHING_QUIZ: Quiz = quizSchema.parse({
  id: "git-branching-merging",
  title: "Git branching & merging",
  kind: "quiz",
  instructions:
    "Ten questions, easiest first: Q1-4 easy, Q5-7 medium, Q8-10 hard. 20 marks in total.",
  visibleTo: ["student"],
  questions: [
    // ---- easy ----
    {
      kind: "mcq",
      id: "gbm-create-switch",
      difficulty: "easy",
      marks: 2,
      prompt: "You are on main. Which single command creates a branch called feature and switches to it?",
      options: [
        { id: "a", text: "git branch feature" },
        { id: "b", text: "git switch -c feature" },
        { id: "c", text: "git merge feature" },
        { id: "d", text: "git switch feature" },
      ],
      correctOptionId: "b",
    },
    {
      kind: "mcq",
      id: "gbm-list-local",
      difficulty: "easy",
      marks: 2,
      prompt: "What does plain git branch (with no arguments) print?",
      options: [
        { id: "a", text: "The local and the remote branches" },
        { id: "b", text: "A new branch called branch" },
        { id: "c", text: "The local branches, with * marking the one you are on" },
        { id: "d", text: "The latest commit of every branch" },
      ],
      correctOptionId: "c",
    },
    {
      kind: "short",
      id: "gbm-list-all",
      difficulty: "easy",
      marks: 2,
      prompt: "Which command lists both the local and the remote branches?",
      acceptedAnswers: ["git branch -a", "git branch --all", "branch -a"],
    },
    {
      kind: "mcq",
      id: "gbm-merge-direction",
      difficulty: "easy",
      marks: 2,
      prompt: "You are on main and run git merge feature. What does Git do?",
      options: [
        { id: "a", text: "Merges main into feature" },
        { id: "b", text: "Switches you onto the feature branch" },
        { id: "c", text: "Deletes the feature branch" },
        { id: "d", text: "Merges the work of feature into main" },
      ],
      correctOptionId: "d",
    },
    // ---- medium ----
    {
      kind: "mcq",
      id: "gbm-no-ff",
      difficulty: "medium",
      marks: 2,
      prompt:
        "Which option forces git merge to always create a merge commit, even when Git could have fast-forwarded?",
      options: [
        { id: "a", text: "--ff-only" },
        { id: "b", text: "--no-ff" },
        { id: "c", text: "--abort" },
        { id: "d", text: "--continue" },
      ],
      correctOptionId: "b",
    },
    {
      kind: "short",
      id: "gbm-switch-back",
      difficulty: "medium",
      marks: 2,
      prompt: "Which command moves you back to the branch you were on just before this one (Git's cd -)?",
      acceptedAnswers: ["git switch -", "git checkout -", "switch -", "checkout -"],
    },
    {
      kind: "mcq",
      id: "gbm-conflict-continue",
      difficulty: "medium",
      marks: 2,
      prompt:
        "A merge stops with conflicts. You fix the files and stage them with git add. Which command completes the merge?",
      options: [
        { id: "a", text: "git merge --abort" },
        { id: "b", text: "git switch -c" },
        { id: "c", text: "git merge --continue" },
        { id: "d", text: "git branch -d" },
      ],
      correctOptionId: "c",
    },
    // ---- hard ----
    {
      kind: "mcq",
      id: "gbm-branch-vs-switch",
      difficulty: "hard",
      marks: 2,
      prompt: "What is the difference between git branch docs and git switch -c docs?",
      options: [
        { id: "a", text: "The first only creates the branch; the second creates it AND moves you onto it" },
        { id: "b", text: "They do exactly the same thing" },
        { id: "c", text: "The first creates and switches; the second only switches to an existing branch" },
        { id: "d", text: "The first renames a branch; the second creates one" },
      ],
      correctOptionId: "a",
    },
    {
      kind: "mcq",
      id: "gbm-force-delete",
      difficulty: "hard",
      marks: 2,
      prompt: "The branch experiment still holds commits that exist nowhere else. Which statement is true?",
      options: [
        { id: "a", text: "Both -d and -D only delete branches that are fully merged" },
        { id: "b", text: "git branch -d refuses to delete it, while git branch -D forces the deletion and can strand those commits" },
        { id: "c", text: "git branch -d always succeeds; -D is the one that refuses unmerged branches" },
        { id: "d", text: "git branch -m deletes the branch and rewrites the history behind it" },
      ],
      correctOptionId: "b",
    },
    {
      kind: "mcq",
      id: "gbm-workflow",
      difficulty: "hard",
      marks: 2,
      prompt:
        "Your work is committed on feature and you want it back in main, with a merge commit recording where it came from. Which sequence is correct?",
      options: [
        { id: "a", text: "git merge main, then git switch feature" },
        { id: "b", text: "git switch -c main, then git merge feature" },
        { id: "c", text: "git switch main, then git merge --no-ff feature" },
        { id: "d", text: "git branch -f main feature" },
      ],
      correctOptionId: "c",
    },
  ],
});
