/**
 * Git fundamentals cheat sheet — content mirror of the classroom wall chart
 * shown at the bottom of the /git-problems page.
 *
 * Three areas (working directory → staging area → repository) plus every
 * command group. Entries marked `simulated: false` are real Git commands the
 * simulator cannot reproduce faithfully (interactive or editor-driven); they
 * render dimmed with a "not simulated" badge. A test keeps this sheet in sync
 * with what src/engine/commands/git-commands.ts actually dispatches.
 */

export interface CheatEntry {
  /** The command as typed, with `<value>` = fill in and `[option]` = optional. */
  cmd: string;
  /** One-line explanation, lifted from the chart. */
  note: string;
  /** false = real Git feature the simulator does not reproduce. */
  simulated?: boolean;
}

export interface CheatSection {
  title: string;
  entries: CheatEntry[];
}

export const GIT_CHEAT_FLOW = {
  boxes: ["Working directory", "Staging area", "Repository"],
  subtitles: ["your files", "next commit", "saved history"],
  steps: ["git add", "git commit"],
} as const;

export const GIT_CHEAT_SHEET: CheatSection[] = [
  {
    title: "Setup (once per machine)",
    entries: [
      { cmd: `git config --global user.name "<name>"`, note: "Name on your commits" },
      { cmd: `git config --global user.email "<email>"`, note: "Email on your commits" },
      { cmd: "git config --global init.defaultBranch main", note: "New repos start on main" },
      { cmd: "git config --list", note: "Show your current settings" },
    ],
  },
  {
    title: "Start and check",
    entries: [
      { cmd: "git init [-b <branch>]", note: "Create a repo in this folder" },
      { cmd: "git status [-s]", note: "See what is untracked, modified or staged" },
    ],
  },
  {
    title: "Stage",
    entries: [
      { cmd: "git add <file>", note: "Stage one file" },
      { cmd: "git add .", note: "Stage everything from here down" },
      { cmd: "git add -p", note: "Stage changes chunk by chunk", simulated: false },
    ],
  },
  {
    title: "Commit",
    entries: [
      { cmd: `git commit -m "<message>"`, note: "Save the staged changes" },
      { cmd: "git commit", note: "Write the message in your editor", simulated: false },
      { cmd: `git commit -am "<message>"`, note: "Stage tracked files and commit (skips new files)" },
    ],
  },
  {
    title: "History",
    entries: [
      { cmd: "git log", note: "Full history, newest first" },
      { cmd: "git log --oneline", note: "One line per commit" },
      { cmd: "git log --stat", note: "Files changed in each commit" },
      { cmd: "git log -p", note: "Full changes in each commit" },
      { cmd: "git log -n <number>", note: "Only the last N commits" },
      { cmd: "git show <commit>", note: "One commit's message and changes" },
    ],
  },
  {
    title: "Compare",
    entries: [
      { cmd: "git diff", note: "Changes not yet staged" },
      { cmd: "git diff --staged", note: "Changes about to be committed" },
      { cmd: "git diff <commit1> <commit2>", note: "Changes between two commits" },
    ],
  },
  {
    title: "Remove and rename",
    entries: [
      { cmd: "git rm <file>", note: "Delete a file and stage the deletion" },
      { cmd: "git rm --cached <file>", note: "Stop tracking it, keep it on disk" },
      { cmd: "git mv <old> <new>", note: "Rename or move a file" },
    ],
  },
];
