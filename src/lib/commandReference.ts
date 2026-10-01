/**
 * Command reference library: a one-line explanation + a runnable example for
 * every command the simulated shell supports (see engine/commands/index.ts),
 * plus the two shell operators (pipes and redirection) the problems rely on.
 *
 * Used by the home-page "Command library" section; the test suite checks that
 * coverage of engine commands stays complete.
 */

export type CommandCategory = "Filesystem" | "Text" | "Session" | "Git" | "Operators";

export type CommandEntry = {
  /** command name as typed in the shell (operators use their symbol) */
  name: string;
  category: CommandCategory;
  /** one-line: what it does */
  summary: string;
  /** a runnable example line */
  example: string;
  /** what the example does, shown next to it */
  exampleNote: string;
  /** optional gotcha worth flagging to beginners */
  caution?: string;
};

export const COMMAND_REFERENCE: CommandEntry[] = [
  // --- Filesystem ---------------------------------------------------------
  {
    name: "pwd",
    category: "Filesystem",
    summary: "Print the full path of the directory you are currently in.",
    example: "pwd",
    exampleNote: "Outputs something like /home/student — always answers \"where am I?\".",
  },
  {
    name: "cd",
    category: "Filesystem",
    summary: "Change to another directory.",
    example: "cd notes",
    exampleNote: "Moves into the notes folder. `cd ..` goes up one level, `cd ~` goes home.",
    caution: "`cd` into a directory you lack execute permission on fails.",
  },
  {
    name: "ls",
    category: "Filesystem",
    summary: "List the contents of a directory.",
    example: "ls -l notes",
    exampleNote: "Long format: permissions, size and name of everything in notes.",
    caution: "Files starting with a dot are hidden unless you pass -a.",
  },
  {
    name: "mkdir",
    category: "Filesystem",
    summary: "Create a new directory.",
    example: "mkdir -p project/src",
    exampleNote: "Creates project and project/src in one go (parents included).",
  },
  {
    name: "touch",
    category: "Filesystem",
    summary: "Create an empty file (or update an existing file's timestamp).",
    example: "touch todo.txt",
    exampleNote: "Creates an empty todo.txt if it doesn't exist yet.",
  },
  {
    name: "cp",
    category: "Filesystem",
    summary: "Copy a file or directory.",
    example: "cp report.txt backup/",
    exampleNote: "Copies report.txt into the backup folder, keeping the original.",
    caution: "Directories need -r (recursive) or the copy fails.",
  },
  {
    name: "mv",
    category: "Filesystem",
    summary: "Move a file — this is also how you rename.",
    example: "mv draft.txt final.txt",
    exampleNote: "Renames draft.txt to final.txt (same folder, new name).",
    caution: "Silently overwrites an existing destination — no undo.",
  },
  {
    name: "rm",
    category: "Filesystem",
    summary: "Delete files (or directories with -r).",
    example: "rm old-notes.txt",
    exampleNote: "Permanently deletes old-notes.txt.",
    caution: "There is no recycle bin. rm -r removes a whole directory tree.",
  },
  {
    name: "chmod",
    category: "Filesystem",
    summary: "Change who can read, write or execute a file.",
    example: "chmod 600 secret.txt",
    exampleNote: "Owner can read+write; group and others get nothing (6=rw-, 0=---).",
  },
  {
    name: "tree",
    category: "Filesystem",
    summary: "Draw a directory and everything inside it as a tree.",
    example: "tree project",
    exampleNote: "Shows the project folder structure recursively — great for orientation.",
  },

  // --- Text ---------------------------------------------------------------
  {
    name: "cat",
    category: "Text",
    summary: "Print the contents of a file (or join several).",
    example: "cat notes/todo.txt",
    exampleNote: "Dumps the file to the terminal. With two files, prints both in order.",
  },
  {
    name: "echo",
    category: "Text",
    summary: "Print text — usually into redirection to make files.",
    example: "echo \"hello\" > hi.txt",
    exampleNote: "Writes hello into hi.txt (creates or overwrites it).",
  },
  {
    name: "grep",
    category: "Text",
    summary: "Print only the lines that match a pattern.",
    example: "grep -c ERROR app.log",
    exampleNote: "Counts how many lines in app.log contain ERROR.",
    caution: "Patterns are case-sensitive unless you add -i.",
  },
  {
    name: "head",
    category: "Text",
    summary: "Show the first lines of input.",
    example: "head -n 3 app.log",
    exampleNote: "Prints the first 3 lines of app.log (default is 10).",
  },
  {
    name: "tail",
    category: "Text",
    summary: "Show the last lines of input.",
    example: "tail -n 5 app.log",
    exampleNote: "Prints the last 5 lines of app.log — handy for recent log entries.",
  },
  {
    name: "wc",
    category: "Text",
    summary: "Count lines, words and characters.",
    example: "wc -l app.log",
    exampleNote: "Prints just the number of lines (-w words, -c characters).",
  },
  {
    name: "sort",
    category: "Text",
    summary: "Sort lines alphabetically.",
    example: "sort names.txt",
    exampleNote: "Prints the lines of names.txt in alphabetical order.",
  },
  {
    name: "uniq",
    category: "Text",
    summary: "Collapse repeated adjacent lines.",
    example: "uniq sorted.txt",
    exampleNote: "Each run of identical lines collapses to one. (Only adjacent duplicates merge — sort first. Add -c to prefix each line with its count.)",
  },
  {
    name: "find",
    category: "Text",
    summary: "Search a directory tree for files by name or type.",
    example: "find . -name \"*.txt\" -type f",
    exampleNote: "Lists every .txt file from the current directory downwards.",
  },

  // --- Session ------------------------------------------------------------
  {
    name: "whoami",
    category: "Session",
    summary: "Print the user you are logged in as.",
    example: "whoami",
    exampleNote: "Outputs student in this simulator.",
  },
  {
    name: "date",
    category: "Session",
    summary: "Print the current date and time.",
    example: "date",
    exampleNote: "Shows the simulated system clock.",
  },
  {
    name: "history",
    category: "Session",
    summary: "List the commands you have run, oldest first.",
    example: "history",
    exampleNote: "Numbered list — useful to re-check what you just did.",
  },
  {
    name: "clear",
    category: "Session",
    summary: "Wipe the terminal screen.",
    example: "clear",
    exampleNote: "Clears the scrollback for a clean slate.",
  },
  {
    name: "man",
    category: "Session",
    summary: "Show the built-in manual page for a command.",
    example: "man grep",
    exampleNote: "Prints grep's synopsis, flags and description inside the simulator.",
  },
  {
    name: "help",
    category: "Session",
    summary: "List every command the simulator supports, grouped by kind.",
    example: "help",
    exampleNote: "Quick in-terminal reminder of what is available (shorter than man).",
  },
  {
    name: "say",
    category: "Session",
    summary: "Speaks the sentence out loud (simulated).",
    example: "say Terminal is fun",
    exampleNote: "On a real Mac this is the macOS `say` voice; in the simulator it echoes the sentence back.",
  },

  // --- Git ----------------------------------------------------------------
  {
    name: "git",
    category: "Git",
    summary: "Version control: set your identity, make a repository, stage files, commit.",
    example: "git init",
    exampleNote: "Turns the current folder into a repository (a hidden .git/ entry appears). Then: git add <file> stages it, git commit -m \"msg\" records it, git log shows history. Configure identity first: git config --global user.name \"Your Name\".",
  },

  // --- Operators ----------------------------------------------------------
  {
    name: "|",
    category: "Operators",
    summary: "Pipe: feed one command's output into the next command.",
    example: "cat app.log | grep ERROR | wc -l",
    exampleNote: "Counts the ERROR lines — each stage does one small job.",
  },
  {
    name: "> and >>",
    category: "Operators",
    summary: "Redirection: save output to a file (>) or append (>>).",
    example: "grep DONE notes.txt > done.txt",
    exampleNote: "Writes the matching lines into done.txt (>> would add to the end).",
    caution: "> overwrites without asking.",
  },
];

/** Categories in stable display order. */
export const COMMAND_CATEGORIES: CommandCategory[] = [
  "Filesystem",
  "Text",
  "Session",
  "Git",
  "Operators",
];
