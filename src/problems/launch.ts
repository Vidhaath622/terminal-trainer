/**
 * Launch problem set for first-year CS students.
 * Authored content: the original 31 problems from navigation to a boss
 * challenge (including a twelve-problem Git fundamentals track), plus the
 * thirty-problem Git practice track imported from ./git-problems -- 61 in all.
 * Pure TypeScript (data) so it can be imported anywhere.
 */
import { problemSchema, type Problem } from "@/engine/schema";
import { GIT_PRACTICE_PROBLEMS } from "./git-problems";

// ---------- Git practice fixtures ----------

const ADA_NAME = "Ada Lovelace";
const ADA_EMAIL = "ada@example.com";

const HELLO_V1 = 'print("hello")\n';
const HELLO_V2 = 'print("hello")\nprint("goodbye")\n';
const README_V1 = "# Demo\n";
const README_V2 = "# Demo\n\nLearning git.\n";

/**
 * Serialized `.git` fixture for the Git problems: a repository with a
 * pre-loaded history (and optional staging area), so history-reading
 * problems start from real commits instead of making the student build one.
 * Shape matches GitMeta in engine/commands/git-commands.ts.
 */
function gitFixture(
  commits: Array<{
    id: string;
    message: string;
    time: number;
    files: Record<string, string>;
    parents?: string[];
  }>,
  staged: Record<string, string> = {},
  branches?: Record<string, string>
): string {
  return JSON.stringify({
    version: 1,
    branch: "main",
    commits: commits.map((c) => ({ ...c, author: ADA_NAME, email: ADA_EMAIL })),
    staged,
    tracked: Object.keys(commits[commits.length - 1].files).sort(),
    local: {},
    ...(branches ? { branches } : {}),
  });
}

/** Three-commit demo history shared by the history-reading problems. */
const DEMO_COMMITS = [
  { id: "a1b2c3d", message: "Start the project", time: 1727769600000, files: { "app.py": HELLO_V1, "README.md": README_V1 } },
  { id: "b4c5d6e", message: "Add a goodbye line", time: 1727856000000, files: { "app.py": HELLO_V2, "README.md": README_V1 } },
  { id: "c7d8e9f", message: "Expand the readme", time: 1727942400000, files: { "app.py": HELLO_V2, "README.md": README_V2 } },
];

const GIT_DEMO_FIXTURE = gitFixture(DEMO_COMMITS);

/** Shared fs for the history-reading problems: the demo repo, working tree clean. */
const GIT_DEMO_FS = {
  dirs: ["/home/student/project"],
  files: [
    { path: "/home/student/project/app.py", content: HELLO_V2 },
    { path: "/home/student/project/README.md", content: README_V2 },
    { path: "/home/student/project/.git", content: GIT_DEMO_FIXTURE },
  ],
  home: "/home/student/project",
  user: "student",
};

/** One-commit repo with an unstaged edit and an untracked file (status practice). */
const GIT_STATUS_FIXTURE = gitFixture([
  { id: "a1b2c3d", message: "Start the project", time: 1727769600000, files: { "app.py": HELLO_V1, "README.md": README_V1 } },
]);

/** One-commit repo with README already staged and an unstaged app.py edit. */
const GIT_STAGED_FIXTURE = gitFixture(
  [{ id: "d1e2f3a", message: "First draft", time: 1727769600000, files: { "app.py": HELLO_V1, "README.md": README_V1 } }],
  { "README.md": "# Demo\n\nDraft notes.\n" }
);

/** One-commit repo with a tracked edit plus an untracked file (commit -a practice). */
const GIT_AM_FIXTURE = gitFixture([
  { id: "e4f5a6b", message: "First draft", time: 1727769600000, files: { "app.py": HELLO_V1 } },
]);

/** One-commit repo with three tracked files awaiting rm / rm --cached / mv. */
const GIT_RM_FIXTURE = gitFixture([
  { id: "f0a1b2c", message: "First draft", time: 1727769600000, files: { "app.py": HELLO_V1, "temp.log": "debug line\n", "draft.txt": "v1\n" } },
]);

/**
 * Two commits on main, the second editing app.py. Students branch from here,
 * change app.py on both sides, and hit a real merge conflict.
 */
const GIT_BRANCH_FIXTURE = gitFixture(
  [
    {
      id: "a1b2c3d",
      message: "Start the project",
      time: 1727769600000,
      files: { "app.py": HELLO_V1, "README.md": README_V1 },
      parents: [],
    },
    {
      id: "b4c5d6e",
      message: "Add main line",
      time: 1727856000000,
      files: { "app.py": 'print("hello")\nprint("main was here")\n', "README.md": README_V1 },
      parents: ["a1b2c3d"],
    },
  ],
  {},
  { main: "b4c5d6e" }
);

const rawProblems = [
  {
    id: "pwd-navigate",
    title: "Finding Your Way",
    difficulty: "easy" as const,
    tags: ["navigation", "pwd", "cd", "ls"],
    brief:
      "Every journey in the terminal starts with knowing where you are. Use pwd to print your working directory, cd to move around, and ls to see what's nearby.",
    fs: {
      dirs: ["/home/student/documents", "/home/student/downloads", "/home/student/music"],
      files: [
        { path: "/home/student/documents/essay.txt", content: "My first essay.\n" },
        { path: "/home/student/downloads/setup.exe", content: "binary\n" },
      ],
      home: "/home/student",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt: "Print your current working directory.",
        hints: ["The command is three letters and asks 'where am I?'"],
        marks: 3,
        checks: [
          { type: "outputEquals" as const, value: "/home/student", marks: 2 },
          { type: "commandUsed" as const, commands: ["pwd"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "List the contents of your home directory.",
        hints: ["The command lists directory contents. Just its two-letter name is enough."],
        marks: 3,
        checks: [
          { type: "outputContains" as const, value: "documents", marks: 2 },
          { type: "commandUsed" as const, commands: ["ls"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Change into the documents directory.",
        hints: ["cd stands for 'change directory'."],
        marks: 3,
        checks: [{ type: "cwdEquals" as const, path: "/home/student/documents", marks: 3 }],
      },
      {
        id: "s4",
        prompt: "Go back to your home directory using the shortcut for 'home'.",
        hints: ["cd with a tilde (~) goes home. Plain cd does too."],
        marks: 3,
        checks: [{ type: "cwdEquals" as const, path: "/home/student", marks: 3 }],
      },
    ],
  },
  {
    id: "ls-inspect",
    title: "Inspecting Files",
    difficulty: "easy" as const,
    tags: ["ls", "cat", "long-format"],
    brief:
      "Before you change anything, look around. ls shows what's here, ls -l reveals permissions and sizes, and cat prints what's inside a file.",
    fs: {
      dirs: ["/home/student/notes"],
      files: [
        { path: "/home/student/README.md", content: "# Welcome\n\nThis is your practice sandbox.\nBe curious.\n" },
        { path: "/home/student/notes/todo.txt", content: "learn ls\ncat a file\ntry ls -l\n" },
      ],
      home: "/home/student",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt: "Show the contents of README.md on the screen.",
        hints: ["cat isn't just the animal - it concatenates and prints files."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "This is your practice sandbox.", marks: 3 },
          { type: "commandUsed" as const, commands: ["cat"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "List files in long format to see permissions and sizes.",
        hints: ["ls takes a flag that makes it 'long'."],
        marks: 4,
        checks: [
          { type: "commandUsedWithFlag" as const, command: "ls", flag: "-l", marks: 3 },
          { type: "outputContains" as const, value: "README.md", marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Peek at the first 2 lines of notes/todo.txt.",
        hints: ["head shows the top of a file; -n sets how many lines."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "learn ls\ncat a file", marks: 3 },
          { type: "commandUsed" as const, commands: ["head"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Show the last line of notes/todo.txt.",
        hints: ["tail is the opposite of head."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "try ls -l", marks: 3 },
          { type: "commandUsed" as const, commands: ["tail"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "mkdir-touch",
    title: "Building Your Workspace",
    difficulty: "easy" as const,
    tags: ["mkdir", "touch", "tree"],
    brief:
      "Time to create. mkdir makes directories, touch makes empty files, and tree draws the whole structure so you can admire your work.",
    fs: { dirs: [], files: [], home: "/", user: "student" },
    steps: [
      {
        id: "s1",
        prompt: "Create a directory called projects.",
        hints: ["mkdir = make directory."],
        marks: 4,
        checks: [{ type: "dirExists" as const, path: "/projects", marks: 4 }],
      },
      {
        id: "s2",
        prompt: "Inside projects, create a directory called web.",
        hints: ["cd projects first, or use mkdir projects/web."],
        marks: 4,
        checks: [{ type: "dirExists" as const, path: "/projects/web", marks: 4 }],
      },
      {
        id: "s3",
        prompt: "Create an empty file called index.html inside projects/web.",
        hints: ["touch creates an empty file."],
        marks: 4,
        checks: [{ type: "fileExists" as const, path: "/projects/web/index.html", marks: 4 }],
      },
      {
        id: "s4",
        prompt: "Create the nested path deep/a/b/c in one command.",
        hints: ["mkdir needs a flag to create parent directories in one go."],
        marks: 4,
        checks: [{ type: "dirExists" as const, path: "/deep/a/b/c", marks: 4 }],
      },
      {
        id: "s5",
        prompt: "Show your work: run tree from the root.",
        hints: ["tree draws directories as branches."],
        marks: 4,
        checks: [
          { type: "commandUsed" as const, commands: ["tree"], marks: 2 },
          { type: "outputContains" as const, value: "index.html", marks: 2 },
        ],
      },
    ],
  },
  {
    id: "terminal-practice",
    title: "Your First Workspace",
    difficulty: "easy" as const,
    tags: ["mkdir", "cd", "pwd", "ls", "touch", "echo", "redirection", "cat"],
    brief:
      "A guided tour of the essential moves: make a workspace on your Desktop, walk into it, create folders and files, write with redirection, and read it all back.",
    fs: { dirs: ["/home/student/Desktop"], files: [], home: "/home/student", user: "student" },
    steps: [
      {
        id: "s1",
        prompt: "Create a folder named terminal-practice on your Desktop.",
        hints: ["mkdir makes a directory: mkdir Desktop/terminal-practice while you're in your home folder."],
        marks: 4,
        checks: [
          { type: "dirExists" as const, path: "/home/student/Desktop/terminal-practice", marks: 3 },
          { type: "commandUsed" as const, commands: ["mkdir"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Move into terminal-practice.",
        hints: ["cd changes directories — cd Desktop/terminal-practice does it in one hop."],
        marks: 4,
        checks: [{ type: "cwdEquals" as const, path: "/home/student/Desktop/terminal-practice", marks: 4 }],
      },
      {
        id: "s3",
        prompt: "Print your current location. Does the path end with terminal-practice?",
        hints: ["pwd answers 'where am I?'."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "/home/student/Desktop/terminal-practice", marks: 3 },
          { type: "commandUsed" as const, commands: ["pwd"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Inside terminal-practice, create three folders one at a time: folder_1, folder_2, folder_3.",
        hints: ["Run mkdir folder_1, then again for folder_2 and folder_3 — or pass all three names to one mkdir."],
        marks: 4,
        checks: [
          { type: "dirExists" as const, path: "/home/student/Desktop/terminal-practice/folder_1", marks: 1 },
          { type: "dirExists" as const, path: "/home/student/Desktop/terminal-practice/folder_2", marks: 1 },
          { type: "dirExists" as const, path: "/home/student/Desktop/terminal-practice/folder_3", marks: 1 },
          { type: "commandUsed" as const, commands: ["mkdir"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "List the contents of the current folder. Do you see all three?",
        hints: ["ls lists what's here."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "folder_1", marks: 1 },
          { type: "outputContains" as const, value: "folder_2", marks: 1 },
          { type: "outputContains" as const, value: "folder_3", marks: 1 },
          { type: "commandUsed" as const, commands: ["ls"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Move into folder_1 and run ls. What do you see, and why?",
        hints: ["It's empty — you haven't put anything inside folder_1 yet."],
        marks: 4,
        checks: [
          { type: "cwdEquals" as const, path: "/home/student/Desktop/terminal-practice/folder_1", marks: 2 },
          { type: "commandUsed" as const, commands: ["ls"], marks: 1 },
          { type: "dirEmpty" as const, path: "/home/student/Desktop/terminal-practice/folder_1", marks: 1 },
        ],
      },
      {
        id: "s7",
        prompt: "Create an empty file named hello.txt inside folder_1.",
        hints: ["touch creates an empty file: touch hello.txt."],
        marks: 4,
        checks: [
          { type: "fileExists" as const, path: "/home/student/Desktop/terminal-practice/folder_1/hello.txt", marks: 3 },
          { type: "commandUsed" as const, commands: ["touch"], marks: 1 },
        ],
      },
      {
        id: "s8",
        prompt: "Put the text Hello Terminal into hello.txt.",
        hints: ["echo prints text, and > redirects it into a file: echo \"Hello Terminal\" > hello.txt."],
        marks: 4,
        checks: [
          { type: "fileEquals" as const, path: "/home/student/Desktop/terminal-practice/folder_1/hello.txt", value: "Hello Terminal", marks: 3 },
          { type: "commandUsed" as const, commands: ["echo"], marks: 1 },
        ],
      },
      {
        id: "s9",
        prompt: "Display the contents of hello.txt.",
        hints: ["cat prints what's inside a file."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Hello Terminal", marks: 3 },
          { type: "commandUsed" as const, commands: ["cat"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "morning-routine",
    title: "Morning Routine",
    difficulty: "easy" as const,
    tags: ["whoami", "date", "mkdir", "touch", "echo", "redirection", "cat"],
    brief:
      "You've just sat down at the machine. Say good morning: find out who the computer thinks you are, check the time, set up a diary folder, write one line in today's diary, and read it back.",
    fs: { dirs: ["/home/student"], files: [], home: "/home/student", user: "student" },
    steps: [
      {
        id: "s1",
        prompt: "Greet your computer: print the name it knows you by.",
        hints: ["whoami prints the name of the current user."],
        marks: 3,
        checks: [
          { type: "outputEquals" as const, value: "student", marks: 2 },
          { type: "commandUsed" as const, commands: ["whoami"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Check the time: print the current date and time.",
        hints: ["date prints the current date and time."],
        marks: 3,
        checks: [{ type: "commandUsed" as const, commands: ["date"], marks: 3 }],
      },
      {
        id: "s3",
        prompt: "Create a folder called diary in your home directory.",
        hints: ["mkdir makes a directory: mkdir diary while you're at home."],
        marks: 4,
        checks: [
          { type: "dirExists" as const, path: "/home/student/diary", marks: 3 },
          { type: "commandUsed" as const, commands: ["mkdir"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Create diary/today.txt and write one line into it using echo and redirection.",
        hints: ["touch diary/today.txt creates the file, then echo \"Good morning, terminal!\" > diary/today.txt writes your line."],
        marks: 4,
        checks: [
          { type: "fileEquals" as const, path: "/home/student/diary/today.txt", value: "Good morning, terminal!", marks: 3 },
          { type: "commandUsed" as const, commands: ["touch", "echo"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Read your line back with cat.",
        hints: ["cat diary/today.txt prints what's inside."],
        marks: 3,
        checks: [
          { type: "outputContains" as const, value: "Good morning, terminal!", marks: 2 },
          { type: "commandUsed" as const, commands: ["cat"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "ask-for-help",
    title: "Ask for Help",
    difficulty: "easy" as const,
    tags: ["help", "man", "history", "clear"],
    brief:
      "The terminal can teach you. help is the map, man is the textbook, history is your diary, and clear is the fresh page. Ask, read, remember, and start clean.",
    fs: { dirs: [], files: [], home: "/home/student", user: "student" },
    steps: [
      {
        id: "s1",
        prompt: "Run help and skim the command groups.",
        hints: ["help prints a one-screen map of the terminal: filesystem commands, text commands, and session commands."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Session:", marks: 3 },
          { type: "commandUsed" as const, commands: ["help"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Read the manual page for ls: man ls. (man mkdir is another page worth a skim.)",
        hints: ["man PAGE shows a command's manual: a SYNOPSIS of the usage, then a DESCRIPTION.", "Curious? Try asking for a page that doesn't exist, like man bogus — the complaint goes to the error channel, not the manual."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "SYNOPSIS", marks: 3 },
          { type: "commandUsed" as const, commands: ["man"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Now that you've run a few commands, run history and find your earlier commands in the numbered list.",
        hints: ["history prints everything you've typed this session, oldest first, with line numbers.", "Your man ls from the last step should be in there — history echoes your exact command lines."],
        marks: 4,
        checks: [
          { type: "commandUsed" as const, commands: ["history"], marks: 2 },
          { type: "outputContains" as const, value: "man ls", marks: 2 },
        ],
      },
      {
        id: "s4",
        prompt: "Clear the screen with clear.",
        hints: ["clear wipes the display — your history and files stay safe, only the page goes blank."],
        marks: 4,
        checks: [{ type: "commandUsed" as const, commands: ["clear"], marks: 4 }],
      },
    ],
  },
  {
    id: "treasure-hunt",
    title: "Treasure Hunt",
    difficulty: "easy" as const,
    tags: ["navigation", "cat", "tree", "find"],
    brief:
      "A note on your desk says the hunt has begun. Each clue names the next folder; the final riddle swears a .secret file is hiding somewhere under your home. Follow the trail — then let find sweep the whole tree in one command.",
    fs: {
      dirs: ["/home/student/downloads", "/home/student/music", "/home/student/pictures"],
      files: [
        { path: "/home/student/note.txt", content: "The hunt begins... look in downloads\n" },
        { path: "/home/student/downloads/clue2.txt", content: "Getting warmer... try music\n" },
        { path: "/home/student/music/clue3.txt", content: "Almost... check pictures\n" },
        { path: "/home/student/pictures/clue4.txt", content: "Final riddle: a file ending in .secret is hiding somewhere under your home...\n" },
        { path: "/home/student/pictures/vacation.jpg", content: "pretend-jpeg-data\n" },
        { path: "/home/student/downloads/setup.exe", content: "binary\n" },
        { path: "/home/student/music/treasure.secret", content: "🎉 You found it! find > guessing.\n" },
      ],
      home: "/home/student",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt: "Read the first clue on your desk: cat note.txt.",
        hints: ["cat prints what's inside a file. You're already home, so cat note.txt works as-is."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "downloads", marks: 3 },
          { type: "commandUsed" as const, commands: ["cat"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Follow the clue: cd into downloads and read clue2.txt.",
        hints: ["cd downloads moves you in; cat clue2.txt reads the next hint."],
        marks: 4,
        checks: [
          { type: "cwdEquals" as const, path: "/home/student/downloads", marks: 2 },
          { type: "outputContains" as const, value: "music", marks: 1 },
          { type: "commandUsed" as const, commands: ["cat"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Warmer indeed — cd into music and read clue3.txt.",
        hints: ["cd ../music hops to a sibling folder: .. goes up one level, then down into music."],
        marks: 4,
        checks: [
          { type: "cwdEquals" as const, path: "/home/student/music", marks: 2 },
          { type: "outputContains" as const, value: "pictures", marks: 1 },
          { type: "commandUsed" as const, commands: ["cat"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Almost there — cd into pictures and read the final riddle in clue4.txt.",
        hints: ["Same move as before: cd ../pictures, then cat clue4.txt."],
        marks: 4,
        checks: [
          { type: "cwdEquals" as const, path: "/home/student/pictures", marks: 2 },
          { type: "outputContains" as const, value: ".secret", marks: 1 },
          { type: "commandUsed" as const, commands: ["cat"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Head back home and survey the whole hunt: run tree to see every folder and file as branches.",
        hints: ["cd ~ jumps home from anywhere. tree draws the full map — red herrings and all."],
        marks: 4,
        checks: [
          { type: "commandUsed" as const, commands: ["tree"], marks: 2 },
          { type: "outputContains" as const, value: "treasure.secret", marks: 2 },
        ],
      },
      {
        id: "s6",
        prompt: "The riddle says the .secret file is 'somewhere'. Search your entire home in ONE command with find, instead of walking into every folder.",
        hints: ["find . -name '*.secret' sweeps everything under the current folder — keep the quotes around the glob.", "That single command just beat cd-ing into every folder and guessing: one sweep, whole tree, exact name match."],
        marks: 4,
        checks: [
          { type: "commandUsed" as const, commands: ["find"], marks: 2 },
          { type: "outputContains" as const, value: "treasure.secret", marks: 2 },
        ],
      },
      {
        id: "s7",
        prompt: "cat the treasure file to claim your prize.",
        hints: ["find showed you exactly where it lives: cat music/treasure.secret while you're home."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "You found it", marks: 3 },
          { type: "commandUsed" as const, commands: ["cat"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "recipe-cards",
    title: "Recipe Cards",
    difficulty: "easy" as const,
    tags: ["mkdir", "touch", "echo", "redirection", "cat", "head", "tail", "wc"],
    brief:
      "Earlier you inspected files you were handed. Now the kitchen is empty: build three recipe cards yourself with mkdir, touch and echo, then read your own cooking back with head, tail, wc and cat.",
    fs: { dirs: ["/home/student"], files: [], home: "/home/student", user: "student" },
    steps: [
      {
        id: "s1",
        prompt: "Set up the kitchen: create a folder called recipes in your home directory.",
        hints: ["mkdir makes a directory: mkdir recipes while you're at home."],
        marks: 4,
        checks: [
          { type: "dirExists" as const, path: "/home/student/recipes", marks: 3 },
          { type: "commandUsed" as const, commands: ["mkdir"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Create three empty recipe cards inside it: pasta.txt, salad.txt and dal.txt.",
        hints: ["touch takes several names at once: touch recipes/pasta.txt recipes/salad.txt recipes/dal.txt makes all three in one line."],
        marks: 4,
        checks: [
          { type: "fileExists" as const, path: "/home/student/recipes/pasta.txt", marks: 1 },
          { type: "fileExists" as const, path: "/home/student/recipes/salad.txt", marks: 1 },
          { type: "fileExists" as const, path: "/home/student/recipes/dal.txt", marks: 1 },
          { type: "commandUsed" as const, commands: ["touch"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Write a 5-line pasta recipe into pasta.txt with echo and redirection. Your recipe — just make sure the word boil appears.",
        hints: ["This simulator writes one line per echo: start with echo \"Boil the water.\" > recipes/pasta.txt, then append each next line with >> — like echo \"Add pasta.\" >> recipes/pasta.txt."],
        marks: 4,
        checks: [
          { type: "fileExists" as const, path: "/home/student/recipes/pasta.txt", marks: 1 },
          { type: "fileMatches" as const, path: "/home/student/recipes/pasta.txt", pattern: "boil", flags: "i", marks: 2 },
          { type: "commandUsed" as const, commands: ["echo"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Write a 3-line salad recipe into salad.txt. Your recipe — just make sure the word greens appears.",
        hints: ["Suggested start: echo \"Toss the greens.\" > recipes/salad.txt, then two more lines with >>."],
        marks: 4,
        checks: [
          { type: "fileExists" as const, path: "/home/student/recipes/salad.txt", marks: 1 },
          { type: "fileMatches" as const, path: "/home/student/recipes/salad.txt", pattern: "greens", flags: "i", marks: 2 },
          { type: "commandUsed" as const, commands: ["echo"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Write a 6-line dal recipe into dal.txt — and make the very last line exactly: Serve hot.",
        hints: ["A later step will read the last line back, so spell it precisely: Serve hot. Suggested start: echo \"Rinse the dal.\" > recipes/dal.txt, then five more lines with >>."],
        marks: 4,
        checks: [
          { type: "fileExists" as const, path: "/home/student/recipes/dal.txt", marks: 1 },
          { type: "fileContains" as const, path: "/home/student/recipes/dal.txt", value: "Serve hot.", marks: 2 },
          { type: "commandUsed" as const, commands: ["echo"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Preview your pasta: show the first 2 lines of pasta.txt with head.",
        hints: ["head shows the top of a file; -n sets how many lines: head -n 2 recipes/pasta.txt."],
        marks: 4,
        checks: [
          { type: "commandUsedWithFlag" as const, command: "head", flag: "-n", marks: 3 },
          { type: "outputContains" as const, value: "oil", marks: 1 },
        ],
      },
      {
        id: "s7",
        prompt: "The secret last step: show the last line of dal.txt with tail. Did it survive the recipe rewrite?",
        hints: ["tail is the opposite of head: tail -n 1 recipes/dal.txt shows exactly the final line."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "Serve hot.", marks: 3 },
          { type: "commandUsed" as const, commands: ["tail"], marks: 1 },
        ],
      },
      {
        id: "s8",
        prompt: "Count the lines in your longest recipe: how many lines in dal.txt?",
        hints: ["wc -l counts lines: wc -l recipes/dal.txt. The number comes first in the output."],
        marks: 3,
        checks: [
          { type: "commandUsed" as const, commands: ["wc"], marks: 1 },
          { type: "outputContains" as const, value: "6", marks: 2 },
        ],
      },
      {
        id: "s9",
        prompt: "Show off: cat one of your recipes from first line to last.",
        hints: ["cat prints a whole file start to finish: cat recipes/salad.txt."],
        marks: 3,
        checks: [
          { type: "commandUsed" as const, commands: ["cat"], marks: 1 },
          { type: "outputContains" as const, value: "greens", marks: 2 },
        ],
      },
    ],
  },
  {
    id: "overwrite-trap",
    title: "The Overwrite Trap",
    difficulty: "easy" as const,
    tags: ["echo", "redirection", "append", "cat", "wc"],
    brief:
      "One symbol can erase your work: > rewrites a file from scratch, >> adds to it. Build a shopping list line by line, then accidentally blow it away with a single > — and let wc -l show you the receipt.",
    fs: { dirs: ["/home/student"], files: [], home: "/home/student", user: "student" },
    steps: [
      {
        id: "s1",
        prompt: "Start a shopping list: put eggs into list.txt with echo and redirection.",
        hints: ["echo \"eggs\" > list.txt writes eggs into list.txt. Warning: > replaces everything in the file — every > starts a fresh page."],
        marks: 4,
        checks: [
          { type: "fileEquals" as const, path: "/home/student/list.txt", value: "eggs", marks: 3 },
          { type: "commandUsed" as const, commands: ["echo"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Add flour and sugar as two more lines on the list — without erasing eggs.",
        hints: [">> appends instead of replacing: echo \"flour\" >> list.txt keeps eggs and adds a line. Add sugar the same way."],
        marks: 4,
        checks: [
          { type: "fileEquals" as const, path: "/home/student/list.txt", value: "eggs\nflour\nsugar", marks: 3 },
          { type: "commandUsed" as const, commands: ["echo"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Admire your work: cat the whole list.",
        hints: ["cat list.txt prints every line, top to bottom."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "eggs", marks: 1 },
          { type: "outputContains" as const, value: "flour", marks: 1 },
          { type: "outputContains" as const, value: "sugar", marks: 1 },
          { type: "commandUsed" as const, commands: ["cat"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Count the lines: how many items are on your list?",
        hints: ["wc -l list.txt counts lines. Remember this number — it's about to matter."],
        marks: 3,
        checks: [
          { type: "outputContains" as const, value: "3", marks: 2 },
          { type: "commandUsed" as const, commands: ["wc"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "A friend texts the whole list as one line. Before you run it, guess what wc -l will say now — then run: echo \"eggs flour sugar\" > list.txt",
        hints: ["One > rewrites list.txt from scratch. Whatever was there before simply isn't anymore."],
        marks: 4,
        checks: [
          { type: "fileEquals" as const, path: "/home/student/list.txt", value: "eggs flour sugar", marks: 3 },
          { type: "commandUsed" as const, commands: ["echo"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Count again: wc -l list.txt. Was your guess right? What happened to your two lines?",
        hints: ["> starts from scratch, >> adds on. There is no undo — flour and sugar are gone forever. When in doubt, >> ."],
        marks: 3,
        checks: [
          { type: "outputContains" as const, value: "1", marks: 2 },
          { type: "commandUsed" as const, commands: ["wc"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "alphabets-workshop",
    title: "Alphabet Workshop",
    difficulty: "medium" as const,
    tags: ["mkdir", "touch", "cp", "mv", "rm", "echo", "redirection", "cat", "say"],
    brief:
      "You're inside your terminal-practice folder from last time. Copy, overwrite, rename, move and delete your way through the alphabet — then make the terminal talk.",
    fs: { dirs: ["/home/student/Desktop/terminal-practice"], files: [], home: "/home/student/Desktop/terminal-practice", user: "student" },
    steps: [
      {
        id: "s1",
        prompt: "Without leaving terminal-practice, create a folder called alphabets and a file called a.txt here. Use ls to confirm.",
        hints: ["mkdir alphabets then touch a.txt — you never need cd."],
        marks: 4,
        checks: [
          { type: "commandUsed" as const, commands: ["mkdir"], marks: 1 },
          { type: "dirExists" as const, path: "alphabets", marks: 1 },
          { type: "fileExists" as const, path: "a.txt", marks: 1 },
          { type: "commandUsed" as const, commands: ["ls"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Write the text apple into a.txt, then read it back.",
        hints: ["echo apple > a.txt writes it; cat a.txt reads it back."],
        marks: 4,
        checks: [
          { type: "fileEquals" as const, path: "a.txt", value: "apple", marks: 2 },
          { type: "commandUsed" as const, commands: ["echo"], marks: 1 },
          { type: "outputContains" as const, value: "apple", marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Copy a.txt to a new file b.txt. Then read b.txt. What does it contain?",
        hints: ["cp a.txt b.txt makes an identical twin."],
        marks: 4,
        checks: [
          { type: "fileExists" as const, path: "b.txt", marks: 1 },
          { type: "fileEquals" as const, path: "b.txt", value: "apple", marks: 1 },
          { type: "commandUsed" as const, commands: ["cp"], marks: 1 },
          { type: "outputContains" as const, value: "apple", marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Now write banana into b.txt and cat it. Then copy a.txt to b.txt again and read b.txt. What happened to banana?",
        hints: ["cp overwrites without asking — banana is gone, replaced by apple."],
        marks: 5,
        checks: [
          { type: "fileEquals" as const, path: "b.txt", value: "apple", marks: 2 },
          { type: "commandUsed" as const, commands: ["echo"], marks: 1 },
          { type: "commandUsed" as const, commands: ["cp"], marks: 1 },
          { type: "outputContains" as const, value: "apple", marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Rename the folder alphabets to letters.",
        hints: ["mv renames directories exactly like files: mv alphabets letters."],
        marks: 4,
        checks: [
          { type: "dirExists" as const, path: "letters", marks: 2 },
          { type: "fileAbsent" as const, path: "alphabets", marks: 1 },
          { type: "commandUsed" as const, commands: ["mv"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Move a.txt into the letters folder. Verify with ls letters.",
        hints: ["mv a.txt letters/ moves it in; ls letters lists the folder's contents."],
        marks: 5,
        checks: [
          { type: "fileExists" as const, path: "letters/a.txt", marks: 2 },
          { type: "fileAbsent" as const, path: "a.txt", marks: 1 },
          { type: "commandUsed" as const, commands: ["mv"], marks: 1 },
          { type: "commandUsed" as const, commands: ["ls"], marks: 1 },
        ],
      },
      {
        id: "s7",
        prompt: "Rename b.txt to modifiedName.txt.",
        hints: ["mv b.txt modifiedName.txt — same command, new name."],
        marks: 4,
        checks: [
          { type: "fileExists" as const, path: "modifiedName.txt", marks: 2 },
          { type: "fileAbsent" as const, path: "b.txt", marks: 1 },
          { type: "commandUsed" as const, commands: ["mv"], marks: 1 },
        ],
      },
      {
        id: "s8",
        prompt: "Delete modifiedName.txt, then confirm it is gone.",
        hints: ["rm modifiedName.txt removes it; ls shows what remains."],
        marks: 4,
        checks: [
          { type: "fileAbsent" as const, path: "modifiedName.txt", marks: 2 },
          { type: "commandUsed" as const, commands: ["rm"], marks: 1 },
          { type: "commandUsed" as const, commands: ["ls"], marks: 1 },
        ],
      },
      {
        id: "s9",
        prompt: "Make your Mac speak the sentence Terminal is fun.",
        hints: ["say Terminal is fun — the simulator's version just says it back to you."],
        marks: 3,
        checks: [
          { type: "outputContains" as const, value: "Terminal is fun", marks: 2 },
          { type: "commandUsed" as const, commands: ["say"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "rename-refactor",
    title: "Rename Refactor",
    difficulty: "medium" as const,
    tags: ["mv", "mkdir", "ls", "tree", "quoting"],
    brief:
      "Someone's desktop equivalent: My Notes.txt, draft2FINAL.txt, todo.old. Rename everything to one tidy convention, gather it into docs/, and verify with tree. Spaces in filenames force a real-world lesson: quoting.",
    fs: {
      dirs: ["/home/student/mess"],
      files: [
        { path: "/home/student/mess/My Notes.txt", content: "meeting notes, half legible\n" },
        { path: "/home/student/mess/draft2FINAL.txt", content: "v2 but actually v5\n" },
        { path: "/home/student/mess/todo.old", content: "1. rename everything\n" },
      ],
      home: "/home/student",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt: "Walk into the chaos: cd mess.",
        hints: ["The messy folder lives right in your home directory."],
        marks: 4,
        checks: [{ type: "cwdEquals" as const, path: "/home/student/mess", marks: 4 }],
      },
      {
        id: "s2",
        prompt: "Survey the damage: list what's in here.",
        hints: ["ls shows the three offenders — one has spaces in its name, which is about to matter."],
        marks: 4,
        checks: [
          { type: "commandUsed" as const, commands: ["ls"], marks: 1 },
          { type: "outputContains" as const, value: "My Notes.txt", marks: 1 },
          { type: "outputContains" as const, value: "draft2FINAL.txt", marks: 1 },
          { type: "outputContains" as const, value: "todo.old", marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Build the destination first: create a folder called docs right here in mess.",
        hints: ["mkdir docs makes the tidy home for your renamed files."],
        marks: 4,
        checks: [
          { type: "dirExists" as const, path: "/home/student/mess/docs", marks: 3 },
          { type: "commandUsed" as const, commands: ["mkdir"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Rename the spacey one and file it away in one move: mv \"My Notes.txt\" docs/my-notes.txt",
        hints: ["The space splits one name into two arguments unless you quote it (\"My Notes.txt\") or backslash-escape it (My\\ Notes.txt) — both work here.", "mv renames AND moves at once: the file lands in docs under its new kebab-case name."],
        marks: 4,
        checks: [
          { type: "fileExists" as const, path: "/home/student/mess/docs/my-notes.txt", marks: 2 },
          { type: "fileAbsent" as const, path: "/home/student/mess/My Notes.txt", marks: 1 },
          { type: "commandUsed" as const, commands: ["mv"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Same treatment for the other two: draft2FINAL.txt becomes docs/draft-2-final.txt, and todo.old becomes docs/todo.txt.",
        hints: ["No quotes needed — these names have no spaces.", "mv rewrites the extension too: it doesn't care what the name ends with, .old and all."],
        marks: 4,
        checks: [
          { type: "fileExists" as const, path: "/home/student/mess/docs/draft-2-final.txt", marks: 1 },
          { type: "fileExists" as const, path: "/home/student/mess/docs/todo.txt", marks: 1 },
          { type: "fileAbsent" as const, path: "/home/student/mess/draft2FINAL.txt", marks: 1 },
          { type: "fileAbsent" as const, path: "/home/student/mess/todo.old", marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Verify the tidy result with tree. Why did ONE command per file suffice to both rename AND file it away?",
        hints: ["tree draws the whole folder — you should see docs with your three renamed files inside, and no trace of the old names."],
        marks: 6,
        checks: [
          { type: "commandUsed" as const, commands: ["tree"], marks: 1 },
          { type: "outputContains" as const, value: "docs", marks: 1 },
          { type: "outputContains" as const, value: "my-notes.txt", marks: 1 },
          { type: "fileAbsent" as const, path: "/home/student/mess/My Notes.txt", marks: 1 },
          { type: "fileAbsent" as const, path: "/home/student/mess/draft2FINAL.txt", marks: 1 },
          { type: "fileAbsent" as const, path: "/home/student/mess/todo.old", marks: 1 },
        ],
      },
    ],
  },
  {
    id: "cp-mv-rename",
    title: "Copying and Moving",
    difficulty: "medium" as const,
    tags: ["cp", "mv"],
    brief:
      "cp copies, mv moves (and renames). These two commands run the world's file management. Careful: mv doesn't ask twice.",
    fs: {
      dirs: ["/home/student/backup"],
      files: [
        { path: "/home/student/report.txt", content: "Q1: good\nQ2: better\n" },
        { path: "/home/student/photo.jpg", content: "pretend-jpeg-data\n" },
      ],
      home: "/home/student",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt: "Copy report.txt into the backup directory.",
        hints: ["cp SOURCE DEST. If DEST is a directory, the file lands inside it."],
        marks: 5,
        checks: [{ type: "fileExists" as const, path: "/home/student/backup/report.txt", marks: 5 }],
      },
      {
        id: "s2",
        prompt: "The original must still exist after copying.",
        hints: ["Nothing to run - this checks that cp (not mv) was used."],
        marks: 3,
        checks: [{ type: "fileExists" as const, path: "/home/student/report.txt", marks: 3 }],
      },
      {
        id: "s3",
        prompt: "Rename photo.jpg to portrait.jpg.",
        hints: ["Renaming is just moving to a new name."],
        marks: 5,
        checks: [
          { type: "fileExists" as const, path: "/home/student/portrait.jpg", marks: 3 },
          { type: "fileAbsent" as const, path: "/home/student/photo.jpg", marks: 2 },
        ],
      },
      {
        id: "s4",
        prompt: "Move portrait.jpg into backup as well.",
        hints: ["Same command as renaming, different destination."],
        marks: 4,
        checks: [
          { type: "fileExists" as const, path: "/home/student/backup/portrait.jpg", marks: 4 },
        ],
      },
    ],
  },
  {
    id: "rm-cleanup",
    title: "Cleaning Up (Carefully)",
    difficulty: "medium" as const,
    tags: ["rm", "rmdir-safety"],
    brief:
      "The terminal has no recycle bin. rm deletes forever. Start gentle with files, then learn the -r flag for directories.",
    fs: {
      dirs: ["/home/student/tmp", "/home/student/keep"],
      files: [
        { path: "/home/student/tmp/old1.log", content: "log\n" },
        { path: "/home/student/tmp/old2.log", content: "log\n" },
        { path: "/home/student/junk.txt", content: "junk\n" },
        { path: "/home/student/keep/precious.txt", content: "DO NOT DELETE\n" },
      ],
      home: "/home/student",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt: "Delete junk.txt.",
        hints: ["rm removes files. It does not ask 'are you sure?'."],
        marks: 4,
        checks: [{ type: "fileAbsent" as const, path: "/home/student/junk.txt", marks: 4 }],
      },
      {
        id: "s2",
        prompt: "Delete the two old log files in tmp in one command.",
        hints: ["rm accepts multiple files: rm a b."],
        marks: 4,
        checks: [
          { type: "fileAbsent" as const, path: "/home/student/tmp/old1.log", marks: 2 },
          { type: "fileAbsent" as const, path: "/home/student/tmp/old2.log", marks: 2 },
        ],
      },
      {
        id: "s3",
        prompt: "Try to delete the keep directory WITHOUT -r and observe the error, then delete it properly with rm -r.",
        hints: ["rm refuses directories without the recursive flag."],
        marks: 5,
        checks: [{ type: "fileAbsent" as const, path: "/home/student/keep", marks: 5 }],
      },
      {
        id: "s4",
        prompt: " precious.txt must have been removed along with its directory.",
        hints: ["This verifies the recursive delete took the contents too."],
        marks: 3,
        checks: [{ type: "fileAbsent" as const, path: "/home/student/keep/precious.txt", marks: 3 }],
      },
    ],
  },
  {
    id: "trash-day",
    title: "Trash Day",
    difficulty: "medium" as const,
    tags: ["rm", "rm -r", "errors", "tree"],
    brief:
      "Same verbs as Cleaning Up — but this time the terminal talks back, and reading it is the skill. Delete a photo, get refused by a stubborn directory, decode the error, and sweep it all away with -r.",
    fs: {
      dirs: ["/home/student/tidy-me", "/home/student/tidy-me/old-project"],
      files: [
        { path: "/home/student/tidy-me/old-photo.jpg", content: "blurry anyway\n" },
        { path: "/home/student/tidy-me/old-project/notes.txt", content: "old ideas\n" },
        { path: "/home/student/tidy-me/old-project/main.py", content: "print('hello')\n" },
      ],
      home: "/home/student",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt: "Walk into the cleanup zone: cd tidy-me.",
        hints: ["The folder lives right in your home directory."],
        marks: 4,
        checks: [{ type: "cwdEquals" as const, path: "/home/student/tidy-me", marks: 4 }],
      },
      {
        id: "s2",
        prompt: "Survey the mess first: run tree and take a mental snapshot — you'll compare at the end.",
        hints: ["tree draws old-photo.jpg, old-project, and everything inside it — the 'before' picture."],
        marks: 4,
        checks: [
          { type: "commandUsed" as const, commands: ["tree"], marks: 2 },
          { type: "outputContains" as const, value: "old-project", marks: 1 },
          { type: "outputContains" as const, value: "old-photo.jpg", marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Start small: delete old-photo.jpg.",
        hints: ["rm removes files. It doesn't ask twice, and there is no trash can."],
        marks: 4,
        checks: [
          { type: "fileAbsent" as const, path: "/home/student/tidy-me/old-photo.jpg", marks: 3 },
          { type: "commandUsed" as const, commands: ["rm"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Now try rm old-project. The terminal refused — read the message word by word: what is it telling you, and what does it suggest you need?",
        hints: ["rm won't touch a directory without the recursive flag — the error says exactly that. This step just wants you to have read it."],
        marks: 4,
        checks: [
          { type: "errorContains" as const, value: "Is a directory", marks: 3 },
          { type: "commandUsed" as const, commands: ["rm"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Now do it properly: remove old-project and everything inside it.",
        hints: ["-r means recurse into everything inside: rm -r old-project. (-rf and -R also work here, but -r is the everyday one.)"],
        marks: 4,
        checks: [
          { type: "fileAbsent" as const, path: "/home/student/tidy-me/old-project", marks: 2 },
          { type: "commandUsedWithFlag" as const, command: "rm", flag: "-r", marks: 2 },
        ],
      },
      {
        id: "s6",
        prompt: "Confirm with tree, and compare with your step 2 snapshot — what changed?",
        hints: ["An empty folder shows tree's summary line: 0 directories, 0 files. No trace of old-project anywhere."],
        marks: 4,
        checks: [
          { type: "commandUsed" as const, commands: ["tree"], marks: 1 },
          { type: "outputContains" as const, value: "0 directories, 0 files", marks: 1 },
          { type: "fileAbsent" as const, path: "/home/student/tidy-me/old-project", marks: 2 },
        ],
      },
    ],
  },
  {
    id: "grep-search",
    title: "Searching with grep",
    difficulty: "medium" as const,
    tags: ["grep", "pipes", "wc"],
    brief:
      "grep finds lines that match a pattern. Combined with pipes it becomes a superpower: count errors, filter logs, and more.",
    fs: {
      dirs: ["/var/log"],
      files: [
        {
          path: "/var/log/app.log",
          content:
            "INFO service started\nERROR disk full\nINFO request handled\nERROR timeout on /api\nWARN slow query\nERROR null pointer\nINFO shutdown clean\n",
        },
      ],
      home: "/",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt: "Print all ERROR lines from /var/log/app.log.",
        hints: ["grep PATTERN FILE prints matching lines."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "ERROR disk full", marks: 2 },
          { type: "outputContains" as const, value: "ERROR null pointer", marks: 2 },
        ],
      },
      {
        id: "s2",
        prompt: "Count how many ERROR lines there are.",
        hints: ["grep has a flag that prints a count instead of the lines. Or pipe to wc -l."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "3", marks: 4 },
        ],
      },
      {
        id: "s3",
        prompt: "Show the log without any INFO lines.",
        hints: ["grep -v inverts the match."],
        marks: 6,
        checks: [
          { type: "outputContains" as const, value: "ERROR disk full", marks: 2 },
          { type: "outputContains" as const, value: "WARN slow query", marks: 2 },
          { type: "commandUsed" as const, commands: ["grep"], marks: 2 },
        ],
      },
      {
        id: "s4",
        prompt: "In one pipeline, count how many lines contain INFO.",
        hints: ["cat file | grep INFO | wc -l"],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "3", marks: 3 },
          { type: "commandUsed" as const, commands: ["wc"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "log-detective",
    title: "Log Detective",
    difficulty: "medium" as const,
    tags: ["grep", "sort", "uniq", "pipes", "redirection", "wc"],
    brief:
      "server.log just rotated and something's wrong. Count the errors, filter the noise, then find which warning repeats most — and learn why sort must come before uniq.",
    fs: {
      dirs: ["/home/student"],
      files: [
        {
          path: "/var/log/server.log",
          content:
            "INFO server started\nERROR disk full\nINFO request handled\nWARN slow query\nERROR timeout on /api\nWARN slow query\nINFO request handled\nWARN disk nearly full\nWARN slow query\nERROR null pointer\nINFO shutdown clean\n",
        },
      ],
      home: "/",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt: "Count the ERRORs: how many lines in /var/log/server.log contain ERROR?",
        hints: ["grep -c prints the count of matching lines instead of the lines themselves: grep -c ERROR /var/log/server.log."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "3", marks: 3 },
          { type: "commandUsed" as const, commands: ["grep"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Show everything that is NOT INFO — the signal without the routine noise.",
        hints: ["grep -v inverts the match: grep -v INFO /var/log/server.log prints every line except the INFO ones."],
        marks: 5,
        checks: [
          { type: "outputContains" as const, value: "ERROR disk full", marks: 2 },
          { type: "outputContains" as const, value: "WARN slow query", marks: 2 },
          { type: "commandUsed" as const, commands: ["grep"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "A teammate says 'just grep error'. Try it — grep error /var/log/server.log — and watch it print nothing. Then fix it with a flag so case doesn't matter.",
        hints: ["grep is case-sensitive: error doesn't match ERROR. Add -i to ignore case: grep -i error /var/log/server.log."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "ERROR disk full", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "grep", flag: "-i", marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "The real question: which warning repeats most? Pipeline it — grep WARN /var/log/server.log | sort | uniq -c",
        hints: ["uniq -c counts each group of repeated lines: you should see '3 WARN slow query'.", "Why sort first? uniq only collapses adjacent repeats — unsorted, the three slow-query lines aren't neighbours, so they'd count separately."],
        marks: 6,
        checks: [
          { type: "outputContains" as const, value: "3 WARN slow query", marks: 3 },
          { type: "outputContains" as const, value: "1 WARN disk nearly full", marks: 2 },
          { type: "commandUsed" as const, commands: ["uniq"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Save the summary for the postmortem: same pipeline, but end it with > /home/student/warning-report.txt",
        hints: ["Redirection works on the last stage of a pipeline: grep WARN /var/log/server.log | sort | uniq -c > /home/student/warning-report.txt writes the report without printing it."],
        marks: 5,
        checks: [
          { type: "fileContains" as const, path: "/home/student/warning-report.txt", value: "3 WARN slow query", marks: 3 },
          { type: "commandUsed" as const, commands: ["sort"], marks: 2 },
        ],
      },
      {
        id: "s6",
        prompt: "Verify the report is exactly two lines: wc -l /home/student/warning-report.txt",
        hints: ["Two lines — one per distinct warning. That's the whole story of the night."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "2", marks: 3 },
          { type: "commandUsed" as const, commands: ["wc"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "find-redirect",
    title: "Finding Files and Saving Output",
    difficulty: "medium" as const,
    tags: ["find", "redirection", "sort"],
    brief:
      "find walks directories looking for names and types. Redirection (> and >>) saves any command's output into a file.",
    fs: {
      dirs: ["/home/student/media/photos", "/home/student/media/videos"],
      files: [
        { path: "/home/student/media/photos/beach.jpg", content: "j1\n" },
        { path: "/home/student/media/photos/sunset.jpg", content: "j2\n" },
        { path: "/home/student/media/videos/clip.mp4", content: "v1\n" },
        { path: "/home/student/readme.txt", content: "b\na\nc\n" },
      ],
      home: "/home/student",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt: "Find every .jpg file under media.",
        hints: ["find PATH -name PATTERN. The pattern *.jpg needs quotes."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "beach.jpg", marks: 2 },
          { type: "outputContains" as const, value: "sunset.jpg", marks: 2 },
        ],
      },
      {
        id: "s2",
        prompt: "Find only directories under media (no files).",
        hints: ["find -type d filters directories."],
        marks: 4,
        checks: [{ type: "commandUsedWithFlag" as const, command: "find", flag: "-type", marks: 4 }],
      },
      {
        id: "s3",
        prompt: "Sort the lines of readme.txt and save the result to sorted.txt.",
        hints: ["sort orders lines; > writes output to a file."],
        marks: 5,
        checks: [
          { type: "fileEquals" as const, path: "/home/student/sorted.txt", value: "a\nb\nc", marks: 4 },
          { type: "commandUsed" as const, commands: ["sort"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Append a line 'done' to sorted.txt without erasing it (echo and >>).",
        hints: [">> appends instead of overwriting."],
        marks: 4,
        checks: [
          { type: "fileContains" as const, path: "/home/student/sorted.txt", value: "done", marks: 2 },
          { type: "fileContains" as const, path: "/home/student/sorted.txt", value: "a", marks: 2 },
        ],
      },
    ],
  },
  {
    id: "chmod-permissions",
    title: "Locking It Down",
    difficulty: "hard" as const,
    tags: ["chmod", "permissions", "ls -l"],
    brief:
      "Unix permissions are octal: owner, group, others - each with read (4), write (2), execute (1). chmod changes them; ls -l shows them.",
    fs: {
      dirs: ["/home/student/scripts"],
      files: [
        { path: "/home/student/scripts/backup.sh", content: "#!/bin/sh\ntar -czf backup.tgz .\n" },
        { path: "/home/student/secret.txt", content: "my diary\n" },
      ],
      home: "/home/student",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt: "Look at the current permissions of backup.sh with ls -l.",
        hints: ["ls -l scripts/backup.sh"],
        marks: 3,
        checks: [
          { type: "commandUsedWithFlag" as const, command: "ls", flag: "-l", marks: 2 },
          { type: "outputContains" as const, value: "backup.sh", marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Make backup.sh executable for everyone: rwxr-xr-x (755).",
        hints: ["chmod 755 FILE"],
        marks: 5,
        checks: [{ type: "mode" as const, path: "/home/student/scripts/backup.sh", mode: "755", marks: 5 }],
      },
      {
        id: "s3",
        prompt: "Make secret.txt private: only the owner can read or write it (600).",
        hints: ["chmod 600 FILE"],
        marks: 5,
        checks: [{ type: "mode" as const, path: "/home/student/secret.txt", mode: "600", marks: 5 }],
      },
      {
        id: "s4",
        prompt: "Confirm with ls -l that the modes changed.",
        hints: ["The first column should now show -rwxr-xr-x for backup.sh."],
        marks: 3,
        checks: [
          { type: "commandUsedWithFlag" as const, command: "ls", flag: "-l", marks: 3 },
        ],
      },
    ],
  },
  {
    id: "git-first-commit",
    title: "Your First Git Commit",
    difficulty: "medium" as const,
    tags: ["git", "config", "init", "add", "commit", "log"],
    brief:
      "Git remembers who you are, then remembers everything you tell it to. Set your identity, turn the project folder into a repository, stage your files, make the first commit, and read the history back — the one-time setup from the Git setup guide, put into practice.",
    fs: {
      dirs: ["/home/student/project"],
      files: [
        { path: "/home/student/project/hello.py", content: "print('hello, git')\n" },
        { path: "/home/student/project/README.md", content: "# My first repo\n\nLearning Git, one commit at a time.\n" },
      ],
      home: "/home/student",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt:
          "Every commit is stamped with a name and email. Set yours globally: user.name to \"Ada Lovelace\" and user.email to ada@example.com. (Quotes matter — the name has a space.)",
        hints: [
          "git config --global user.name \"Ada Lovelace\" — the flag order is: command, --global, key, value.",
          "Then the same shape for email: git config --global user.email ada@example.com. No quotes needed — no space.",
        ],
        marks: 6,
        checks: [
          { type: "fileExists" as const, path: "/home/student/.gitconfig", marks: 2 },
          { type: "fileContains" as const, path: "/home/student/.gitconfig", value: "user.name = Ada Lovelace", marks: 2 },
          { type: "fileContains" as const, path: "/home/student/.gitconfig", value: "user.email = ada@example.com", marks: 2 },
        ],
      },
      {
        id: "s2",
        prompt:
          "Print every setting Git knows so far. Somewhere in the list you should see the name and email you just chose — this is the command to reach for whenever commits show the wrong identity.",
        hints: ["git config --list — the last value shown for a key is the one that wins."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "user.name=Ada Lovelace", marks: 2 },
          { type: "outputContains" as const, value: "user.email=ada@example.com", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt:
          "Name the first branch 'main' for every future repository, then cd into project and turn it into a repository with git init.",
        hints: [
          "git config --global init.defaultBranch main — this affects new repositories only; it never renames existing branches.",
          "git init inside project/ creates the hidden .git/ entry that makes the folder a repository. Run it once per project.",
        ],
        marks: 6,
        checks: [
          { type: "fileExists" as const, path: "/home/student/project/.git", marks: 2 },
          { type: "outputContains" as const, value: "Initialized empty Git repository", marks: 2 },
          { type: "commandUsed" as const, commands: ["git"], marks: 2 },
        ],
      },
      {
        id: "s4",
        prompt:
          "Ask the repository where things stand: git status. Nothing is tracked yet — hello.py and README.md should be listed as untracked.",
        hints: [
          "git status is the first thing to run whenever git feels confusing.",
          "Expect an 'Untracked files:' section naming hello.py and README.md, plus 'No commits yet'.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Untracked files:", marks: 2 },
          { type: "outputContains" as const, value: "hello.py", marks: 1 },
          { type: "outputContains" as const, value: "No commits yet", marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt:
          "Stage both files for the first commit — one command, from inside project — then confirm with git status: they should appear under 'Changes to be committed:'.",
        hints: [
          "git add hello.py README.md stages both, or git add . stages everything in the repository at once.",
          "Staging builds the snapshot you are about to commit — it does not save history yet. git status shows it as 'new file'.",
        ],
        marks: 4,
        checks: [
          { type: "commandUsed" as const, commands: ["git"], marks: 2 },
          { type: "outputContains" as const, value: "Changes to be committed:", marks: 1 },
          { type: "outputContains" as const, value: "new file:", marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt:
          "Commit the staged snapshot with the message: First commit. git commit -m \"First commit\" — then status should say the working tree is clean.",
        hints: [
          "The -m flag attaches the message; without it git refuses to commit.",
          "Commit messages say what and why: 'Fix login redirect', not 'changes'.",
        ],
        marks: 6,
        checks: [
          { type: "outputContains" as const, value: "(root-commit)", marks: 2 },
          { type: "outputContains" as const, value: "First commit", marks: 2 },
          { type: "commandUsed" as const, commands: ["git"], marks: 2 },
        ],
      },
      {
        id: "s7",
        prompt:
          "Prove the commit exists: git log should show the commit id, the author line \"Ada Lovelace <ada@example.com>\" — the identity you configured in step 1 — and the message.",
        hints: [
          "git log lists commits newest first; each entry has commit <id>, Author:, Date: and the message.",
        ],
        marks: 6,
        checks: [
          { type: "outputContains" as const, value: "Author: Ada Lovelace <ada@example.com>", marks: 3 },
          { type: "outputContains" as const, value: "commit ", marks: 2 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s8",
        prompt:
          "The satisfying end to a first commit: one last git status. It should say 'nothing to commit, working tree clean'.",
        hints: [
          "Same command as step 4 — but now nothing is untracked and nothing is staged. That's what a clean tree looks like.",
        ],
        marks: 3,
        checks: [
          { type: "outputContains" as const, value: "nothing to commit, working tree clean", marks: 2 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-setup-drill",
    title: "Once Per Machine",
    difficulty: "easy" as const,
    tags: ["git", "config", "setup"],
    brief:
      "The Setup section of the cheat sheet, made muscle memory: tell Git who you are and what the first branch should be called — then read the settings back with --list.",
    fs: { dirs: ["/home/student"], files: [], home: "/home/student", user: "student" },
    steps: [
      {
        id: "s1",
        prompt:
          "Set your global Git identity: user.name to \"Grace Hopper\". (Quotes matter — the name has a space.)",
        hints: [
          "git config --global user.name \"Grace Hopper\" — the order is: command, --global, key, value.",
          "This lands in ~/.gitconfig, the file Git reads on every machine it's set up on — hence 'once per machine'.",
        ],
        marks: 4,
        checks: [
          { type: "fileExists" as const, path: "/home/student/.gitconfig", marks: 2 },
          { type: "fileContains" as const, path: "/home/student/.gitconfig", value: "user.name = Grace Hopper", marks: 2 },
        ],
      },
      {
        id: "s2",
        prompt: "Now the email: user.email to grace@example.com.",
        hints: ["Same shape as the name: git config --global user.email grace@example.com. No quotes needed — no space."],
        marks: 4,
        checks: [
          { type: "fileContains" as const, path: "/home/student/.gitconfig", value: "user.email = grace@example.com", marks: 4 },
        ],
      },
      {
        id: "s3",
        prompt:
          "Name the first branch of every future repository 'main': set init.defaultBranch to main.",
        hints: [
          "git config --global init.defaultBranch main — it affects new repositories only, never existing branches.",
        ],
        marks: 4,
        checks: [
          { type: "fileContains" as const, path: "/home/student/.gitconfig", value: "init.defaultBranch = main", marks: 4 },
        ],
      },
      {
        id: "s4",
        prompt:
          "Read it all back: git config --list should show all three settings you just chose.",
        hints: [
          "--list prints every setting Git knows, one per line as key=value. Whenever commits show the wrong identity, this is the command to run.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "user.name=Grace Hopper", marks: 2 },
          { type: "outputContains" as const, value: "user.email=grace@example.com", marks: 1 },
          { type: "outputContains" as const, value: "init.defaultBranch=main", marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-init-branch",
    title: "Pick Your First Branch",
    difficulty: "easy" as const,
    tags: ["git", "init", "status"],
    brief:
      "Turn a plain folder into a repository — the 'Start and check' section in action. Choose the starting branch with git init -b, then check where you stand with git status.",
    fs: {
      dirs: ["/home/student/project"],
      files: [{ path: "/home/student/project/notes.txt", content: "project ideas\n" }],
      home: "/home/student",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt: "Walk into the project folder: cd project.",
        hints: ["The folder lives right in your home directory. git init works on the CURRENT folder, so be inside project first."],
        marks: 4,
        checks: [{ type: "cwdEquals" as const, path: "/home/student/project", marks: 4 }],
      },
      {
        id: "s2",
        prompt:
          "Turn this folder into a repository whose first branch is called main: git init -b main.",
        hints: [
          "-b names the starting branch, overriding init.defaultBranch for this one repository.",
          "The hidden .git entry it creates is what makes the folder a repository — run it once per project.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Initialized empty Git repository", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt:
          "Check where you stand: git status. Which branch are you on, and what does Git say about notes.txt?",
        hints: [
          "Expect 'On branch main', 'No commits yet', and notes.txt listed as untracked — Git sees it but isn't tracking it yet.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "On branch main", marks: 2 },
          { type: "outputContains" as const, value: "No commits yet", marks: 1 },
          { type: "outputContains" as const, value: "notes.txt", marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt:
          "Run git init a second time. Does it wipe anything? Read the message.",
        hints: [
          "Initializing an existing repository is safe: Git reinitializes and leaves everything exactly as it was.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Reinitialized existing Git repository", marks: 4 },
        ],
      },
    ],
  },
  {
    id: "git-status-short",
    title: "Status at a Glance",
    difficulty: "easy" as const,
    tags: ["git", "status", "add"],
    brief:
      "git status is verbose; git status -s is the terse version pros type all day. Learn to read both: an edit sitting unstaged, a fresh untracked file, then stage the edit and watch the letters move.",
    fs: {
      dirs: ["/home/student/project"],
      files: [
        { path: "/home/student/project/app.py", content: "print(\"hello\")\nprint(\"goodbye\")\n" },
        { path: "/home/student/project/README.md", content: "# Demo\n" },
        { path: "/home/student/project/todo.txt", content: "buy milk\n" },
        { path: "/home/student/project/.git", content: GIT_STATUS_FIXTURE },
      ],
      home: "/home/student/project",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt:
          "Ask the repository where things stand: git status. One file is modified but not staged, one is untracked — find both sections.",
        hints: [
          "app.py was edited after the last commit, so it sits under 'Changes not staged for commit:'.",
          "todo.txt is brand new — Git lists it under 'Untracked files:'.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Changes not staged for commit:", marks: 2 },
          { type: "outputContains" as const, value: "modified:   app.py", marks: 1 },
          { type: "outputContains" as const, value: "Untracked files:", marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt:
          "Now the short form: git status -s. Two letters per file. Which pair of letters marks app.py, and which marks todo.txt?",
        hints: [
          "' M' (blank then M) means modified but not staged; '??' means untracked.",
          "The first letter column is the staging area, the second is the working directory.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: " M app.py", marks: 2 },
          { type: "outputContains" as const, value: "?? todo.txt", marks: 2 },
        ],
      },
      {
        id: "s3",
        prompt:
          "Stage the edit with git add app.py, then run git status -s again. The M jumped to the first column — it's ready for the next commit.",
        hints: [
          "After staging, the line reads 'M  app.py': M in the staging column, blank in the working column.",
          "todo.txt keeps its ?? — git add . would take it too, but you staged only app.py.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "M  app.py", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-log-formats",
    title: "Three Ways to Log",
    difficulty: "easy" as const,
    tags: ["git", "log", "history"],
    brief:
      "A repository with three commits is waiting. Read its history three ways from the cheat sheet's History section: full git log, the one-line digest, and -n to limit how far back you go.",
    fs: GIT_DEMO_FS,
    steps: [
      {
        id: "s1",
        prompt:
          "Read the whole history: git log. Newest commit first — what's the id and message of the latest one?",
        hints: [
          "Each entry shows commit <id>, Author:, Date:, then the message indented by four spaces.",
          "The newest commit here is 'Expand the readme'.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "c7d8e9f", marks: 2 },
          { type: "outputContains" as const, value: "Expand the readme", marks: 2 },
        ],
      },
      {
        id: "s2",
        prompt:
          "Same history, one line per commit: git log --oneline.",
        hints: ["--oneline collapses each commit to '<id> <message>' — the shape you'll scan in a real terminal."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "c7d8e9f Expand the readme", marks: 2 },
          { type: "outputContains" as const, value: "a1b2c3d Start the project", marks: 2 },
        ],
      },
      {
        id: "s3",
        prompt:
          "Only the recent past: show the last 2 commits with git log --oneline -n 2.",
        hints: ["-n <number> limits how many commits you see. The oldest one should disappear from the list."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "b4c5d6e Add a goodbye line", marks: 2 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "-n", marks: 2 },
        ],
      },
      {
        id: "s4",
        prompt:
          "Full detail, newest commit only: git log -n 1.",
        hints: ["Without --oneline you get the full entry again — id, author, date, message — but just one of them."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "c7d8e9f", marks: 2 },
          { type: "outputContains" as const, value: "Author: Ada Lovelace <ada@example.com>", marks: 1 },
          { type: "outputContains" as const, value: "Expand the readme", marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-log-stat",
    title: "Who Touched What",
    difficulty: "medium" as const,
    tags: ["git", "log", "history", "pipes", "wc"],
    brief:
      "History with numbers: --stat appends a per-file tally to every commit. Combine it with the pipes you already know — wc -l to count commits, grep to find the one about the readme.",
    fs: GIT_DEMO_FS,
    steps: [
      {
        id: "s1",
        prompt:
          "Show each commit with its file tally: git log --stat. Which commit touched README.md by two lines?",
        hints: [
          "Each entry gains rows like ' README.md | 2 ++' plus a 'N files changed, X insertions(+), Y deletions(-)' summary.",
          "The newest commit is the one that expanded the readme.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "README.md | 2 ++", marks: 2 },
          { type: "outputContains" as const, value: "1 file changed, 2 insertions(+), 0 deletions(-)", marks: 2 },
        ],
      },
      {
        id: "s2",
        prompt:
          "How many commits does this history have? One pipeline: git log --oneline piped into wc -l.",
        hints: ["git log --oneline | wc -l — each commit is one line, so counting lines counts commits."],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "3", marks: 3 },
          { type: "commandUsed" as const, commands: ["wc"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt:
          "Find the commit about the readme: pipe git log --oneline into grep readme.",
        hints: ["git log --oneline | grep readme — grep filters the one-line entries for the word."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Expand the readme", marks: 2 },
          { type: "outputContains" as const, value: "c7d8e9f", marks: 1 },
          { type: "commandUsed" as const, commands: ["grep"], marks: 1 },
        ],
      },
      {
id: "s4",
        prompt:
          "The two most recent commits, with their tallies: git log --stat -n 2.",
        hints: ["Flags combine freely: --stat for the numbers, -n 2 to stop after two commits."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "app.py | 1 +", marks: 2 },
          { type: "outputContains" as const, value: "README.md | 2 ++", marks: 1 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "-n", marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-show-patch",
    title: "Read the Patch",
    difficulty: "medium" as const,
    tags: ["git", "show", "log", "history", "diff"],
    brief:
      "Commits carry their own diffs. git show prints one commit with its patch; git log -p prints every commit with theirs. Learn to read the '-' and '+' lines — that skill is the whole History section's punchline.",
    fs: GIT_DEMO_FS,
    steps: [
      {
        id: "s1",
        prompt:
          "Inspect the latest commit: git show HEAD. Which file changed, and what line did it gain?",
        hints: [
          "HEAD means 'the newest commit'. The output is the commit header followed by its patch.",
          "Patch lines start with '-' (removed) or '+' (added); context lines start with a space.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "diff --git a/README.md b/README.md", marks: 2 },
          { type: "outputContains" as const, value: "+Learning git.", marks: 2 },
        ],
      },
      {
        id: "s2",
        prompt:
          "One step back: git show HEAD~1 (or git show b4c5d6e). What did THAT commit add?",
        hints: [
          "HEAD~1 is the commit before HEAD; a few characters of the id work too.",
          "Look for the line that was added to app.py.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "+print(\"goodbye\")", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
      id: "s3",
        prompt:
          "Every patch at once: git log -p. Scroll mentally through all three commits — the first one created files from nothing.",
        hints: [
          "-p attaches the patch to every entry in the log.",
          "Brand-new files appear with 'new file mode 100644' and everything as '+' lines.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "new file mode 100644", marks: 2 },
          { type: "outputContains" as const, value: "+Learning git.", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt:
          "The very first commit: git show a1b2c3d. Both files were born here.",
        hints: ["With no parent commit, the whole tree shows as additions — '--- /dev/null' means 'did not exist before'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "new file mode 100644", marks: 2 },
          { type: "outputContains" as const, value: "+print(\"hello\")", marks: 2 },
        ],
      },
    ],
  },
  {
    id: "git-diff-staged",
    title: "Before You Commit",
    difficulty: "medium" as const,
    tags: ["git", "diff", "add", "stage"],
    brief:
      "The Compare section's most useful habit: git diff shows changes you haven't staged yet, git diff --staged shows what the next commit will contain. This repo has one of each — tell them apart, then stage the straggler.",
    fs: {
      dirs: ["/home/student/project"],
      files: [
        { path: "/home/student/project/app.py", content: "print(\"hello\")\nprint(\"goodbye\")\n" },
        { path: "/home/student/project/README.md", content: "# Demo\n\nDraft notes.\n" },
        { path: "/home/student/project/.git", content: GIT_STAGED_FIXTURE },
      ],
      home: "/home/student/project",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt:
          "Survey first: git status. One file is staged for the next commit, a different file is edited but not staged.",
        hints: [
          "README.md is under 'Changes to be committed:'; app.py is under 'Changes not staged for commit:'.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Changes to be committed:", marks: 1 },
          { type: "outputContains" as const, value: "modified:   README.md", marks: 1 },
          { type: "outputContains" as const, value: "Changes not staged for commit:", marks: 1 },
          { type: "outputContains" as const, value: "modified:   app.py", marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt:
          "What have you NOT staged yet? git diff compares the working directory against the staging area.",
        hints: [
          "Plain git diff only shows unstaged work — here that's the app.py edit.",
          "The '+' line is the goodbye line you added.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "+print(\"goodbye\")", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt:
          "And what WILL the next commit contain? git diff --staged compares the staging area against the last commit.",
        hints: [
          "--staged (or --cached) flips the comparison: staging area vs HEAD.",
          "Here that's the README.md draft notes.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "+Draft notes.", marks: 3 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--staged", marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt:
          "Stage the app.py edit too (git add app.py), then run git status — everything is now waiting in the staging area.",
        hints: [
          "After staging, both files sit under 'Changes to be committed:' and the working tree has no unstaged edits.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Changes to be committed:", marks: 1 },
          { type: "outputContains" as const, value: "modified:   app.py", marks: 1 },
          { type: "outputContains" as const, value: "modified:   README.md", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-diff-commits",
    title: "Then vs Now",
    difficulty: "medium" as const,
    tags: ["git", "diff", "history", "pipes", "wc"],
    brief:
      "git diff takes commit ids: two of them compares then vs now, and order matters — swap them and every '+' becomes a '-'. Then count the changed lines by piping into wc -l.",
    fs: GIT_DEMO_FS,
    steps: [
      {
        id: "s1",
        prompt:
          "What changed between the first commit and the last? git diff a1b2c3d c7d8e9f — old first, new second.",
        hints: [
          "Both files changed: app.py gained a goodbye, README.md gained a note.",
          "Diff order is '<from> <to>': lines present in c7d8e9f but not a1b2c3d show as '+'.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "+print(\"goodbye\")", marks: 2 },
          { type: "outputContains" as const, value: "+Learning git.", marks: 2 },
        ],
      },
      {
        id: "s2",
        prompt:
          "Now backwards: git diff c7d8e9f a1b2c3d. Read the same two files — every plus turned into a minus.",
        hints: ["Reversing the arguments asks 'what would I lose by going back?' — the answer shows as '-' lines."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "-print(\"goodbye\")", marks: 2 },
          { type: "outputContains" as const, value: "-Learning git.", marks: 2 },
        ],
      },
      {
        id: "s3",
        prompt:
          "Count the diff's lines in one pipeline: git diff a1b2c3d c7d8e9f piped into wc -l.",
        hints: [
          "Headers, hunk markers and context lines all count as lines — that's the point: a diff is just text.",
        ],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "13", marks: 3 },
          { type: "commandUsed" as const, commands: ["wc"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt:
          "Short form: git diff a1b2c3d with ONE commit compares that commit against the current state of your working directory.",
        hints: ["With a single ref, the second side is 'right now'. The working tree here matches the newest commit, so the output matches step 1."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "+print(\"goodbye\")", marks: 2 },
          { type: "outputContains" as const, value: "+Learning git.", marks: 2 },
        ],
      },
    ],
  },
  {
    id: "git-commit-am",
    title: "Skip a Step (Carefully)",
    difficulty: "medium" as const,
    tags: ["git", "commit", "add", "status"],
    brief:
      "git commit -am bundles 'stage tracked edits' and 'commit' into one command — but only for files Git already tracks. A brand-new file slips through the net. Prove it.",
    fs: {
      dirs: ["/home/student/project"],
      files: [
        { path: "/home/student/project/app.py", content: "print(\"hello\")\nprint(\"goodbye\")\n" },
        { path: "/home/student/project/notes.txt", content: "meeting at noon\n" },
        { path: "/home/student/project/.git", content: GIT_AM_FIXTURE },
      ],
      home: "/home/student/project",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt:
          "Survey: git status. Two things await: a tracked edit (app.py) and an untracked file (notes.txt).",
        hints: [
          "app.py sits under 'Changes not staged for commit:'; notes.txt is untracked.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Changes not staged for commit:", marks: 2 },
          { type: "outputContains" as const, value: "Untracked files:", marks: 1 },
          { type: "outputContains" as const, value: "notes.txt", marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt:
          "One command for the edit: git commit -am \"Add goodbye line\". The -a stages tracked changes before committing.",
        hints: [
          "-am = -a + -m: stage tracked edits, then commit with the message.",
          "Watch the summary line: how many files changed?",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "1 file changed", marks: 2 },
          { type: "outputContains" as const, value: "Add goodbye line", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt:
          "git status again. notes.txt is STILL untracked — -a never touches files Git doesn't know yet.",
        hints: [
          "The commit -a shortcut only covers edits and deletions of already-tracked files.",
          "New files always need an explicit git add first — this is the gotcha the cheat sheet warns about.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Untracked files:", marks: 2 },
          { type: "outputContains" as const, value: "notes.txt", marks: 2 },
        ],
      },
      {
        id: "s4",
        prompt:
          "Give notes.txt the full treatment: git add notes.txt, then git commit -m \"Add meeting notes\".",
        hints: [
          "The commit output should mention 'create mode 100644 notes.txt' — the file just became part of history.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "create mode 100644 notes.txt", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt:
          "Admire the result: git log --oneline should list three commits, newest first.",
        hints: ["'Add meeting notes', then 'Add goodbye line', then 'First draft'."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Add meeting notes", marks: 2 },
          { type: "outputContains" as const, value: "Add goodbye line", marks: 1 },
          { type: "outputContains" as const, value: "First draft", marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-rm-mv",
    title: "Untrack, Remove, Rename",
    difficulty: "hard" as const,
    tags: ["git", "rm", "mv", "add", "commit", "status"],
    brief:
      "The Remove-and-rename section, all of it: git mv renames a tracked file, git rm deletes one, and git rm --cached just stops tracking it while leaving the file on your disk. Three verbs, three different leftovers — track what happens to the files AND to history.",
    fs: {
      dirs: ["/home/student/project"],
      files: [
        { path: "/home/student/project/app.py", content: "print(\"hello\")\n" },
        { path: "/home/student/project/temp.log", content: "debug line\n" },
        { path: "/home/student/project/draft.txt", content: "v1\n" },
        { path: "/home/student/project/.git", content: GIT_RM_FIXTURE },
      ],
      home: "/home/student/project",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt:
          "Rename a tracked file the Git way: git mv draft.txt notes.txt, then git status. Notice both sides of the rename in the staging area.",
        hints: [
          "git mv renames on disk AND stages the change — no separate git add needed.",
          "Status shows it as a 'new file' plus a 'deleted' file: a rename records as remove-old + add-new.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "new file:   notes.txt", marks: 2 },
          { type: "outputContains" as const, value: "deleted:    draft.txt", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt:
          "Record the rename: git commit -m \"Rename draft to notes\".",
        hints: [
          "The output lists one 'create mode' and one 'delete mode' — the two halves of the rename.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "create mode 100644 notes.txt", marks: 2 },
          { type: "outputContains" as const, value: "delete mode 100644 draft.txt", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt:
          "Delete for real: git rm temp.log, then git status. The file is gone from disk AND staged for removal.",
        hints: [
          "git rm = delete the file + stage the deletion, ready for the next commit.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "deleted:    temp.log", marks: 2 },
          { type: "fileAbsent" as const, path: "/home/student/project/temp.log", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt:
          "Commit the deletion: git commit -m \"Remove debug log\".",
        hints: ["The output should include 'delete mode 100644 temp.log' — history now records the file's death."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "delete mode 100644 temp.log", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt:
          "Now the subtle one: git rm --cached notes.txt, then git status. The file vanished from the staging area — but is it gone from your disk?",
        hints: [
          "--cached removes it from Git's tracking only — the file itself stays on disk.",
          "Status tells the story twice: 'deleted: notes.txt' staged, AND notes.txt listed as untracked — Git forgot it, your disk didn't.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "deleted:    notes.txt", marks: 2 },
          { type: "fileExists" as const, path: "/home/student/project/notes.txt", marks: 1 },
          { type: "outputContains" as const, value: "Untracked files:", marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt:
          "Make the untracking official: git commit -m \"Stop tracking notes\".",
        hints: [
          "The commit records the removal from the repository; the file on disk is untouched.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "delete mode 100644 notes.txt", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s7",
        prompt:
          "Final check: git status one more time. notes.txt is untracked but still on disk — exactly what --cached promises.",
        hints: [
          "Run ls if you want extra proof the file survived.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Untracked files:", marks: 2 },
          { type: "outputContains" as const, value: "notes.txt", marks: 1 },
          { type: "fileExists" as const, path: "/home/student/project/notes.txt", marks: 1 },
        ],
      },
    ],
  },
  {
    id: "git-branch-merge",
    title: "Branch, Switch, Merge",
    difficulty: "hard" as const,
    tags: ["git", "branch", "switch", "merge", "commit"],
    brief:
      "The 'Git branching & merging' notes end to end: branch off with git branch, move over with git switch, commit on each side, then merge. Both sides touch app.py, so Git stops you with a conflict — resolve it by hand and finish with git merge --continue.",
    fs: {
      dirs: ["/home/student/project"],
      files: [
        { path: "/home/student/project/app.py", content: 'print("hello")\nprint("main was here")\n' },
        { path: "/home/student/project/README.md", content: README_V1 },
        { path: "/home/student/project/.git", content: GIT_BRANCH_FIXTURE },
      ],
      home: "/home/student/project",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt: "List every local branch: git branch. The line starting with '*' is where you stand.",
        hints: ["Run it with no arguments: git branch prints each branch name, and * marks the current one."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "* main", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s2",
        prompt: "Create a branch named feature without moving: git branch feature. Then run git branch again to see both.",
        hints: [
          "A branch is just a name pointing at the commit you are on now — git branch <name> prints nothing when it works.",
          "The listing should now show '* main' and a '  feature' line.",
        ],
        marks: 4,
        checks: [
          { type: "branchExists" as const, branch: "feature", marks: 2 },
          { type: "outputContains" as const, value: "* main", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s3",
        prompt: "Move HEAD over: git switch feature.",
        hints: ["git switch <branch> checks out that branch's files; the confirmation reads \"Switched to branch 'feature'\"."],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Switched to branch 'feature'", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Make a change on the branch: echo 'print(\"shipped\")' >> app.py, git add app.py, then git commit -m \"Add shipped line\".",
        hints: [
          "Three commands: append the line, stage it, commit it — all while feature is checked out.",
          "The commit line reads \"[feature ...] Add shipped line\".",
        ],
        marks: 4,
        checks: [
          { type: "fileContains" as const, path: "/home/student/project/app.py", value: "print(\"shipped\")", marks: 2 },
          { type: "outputContains" as const, value: "Add shipped line", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s5",
        prompt: "Go back: git switch main. Then cat app.py — what happened to your shipped line?",
        hints: [
          "Switching restores the target branch's files; the shipped line only exists on feature.",
          "app.py on main again ends with print(\"main was here\").",
        ],
        marks: 4,
        checks: [
          { type: "onBranch" as const, branch: "main", marks: 2 },
          { type: "fileContains" as const, path: "/home/student/project/app.py", value: "print(\"main was here\")", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s6",
        prompt: "Diverge on purpose: echo 'print(\"hotfix\")' >> app.py, git add app.py, git commit -m \"Fix a bug\". Now both branches change app.py.",
        hints: [
          "Same three beats as before — append, stage, commit — but this time you are on main.",
          "The commit line reads \"[main ...] Fix a bug\".",
        ],
        marks: 4,
        checks: [
          { type: "fileContains" as const, path: "/home/student/project/app.py", value: "print(\"hotfix\")", marks: 2 },
          { type: "outputContains" as const, value: "Fix a bug", marks: 1 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s7",
        prompt: "Join the branches: git merge feature. Read the CONFLICT message Git prints.",
        hints: [
          "git merge <branch> brings the other branch into the one you are on — you are already on main.",
          "Both sides edited app.py, so Git refuses to guess and marks the file with <<<<<<< and >>>>>>> lines.",
        ],
        marks: 4,
        checks: [
          { type: "errorContains" as const, value: "Merge conflict in app.py", marks: 3 },
          { type: "commandUsed" as const, commands: ["git"], marks: 1 },
        ],
      },
      {
        id: "s8",
        prompt: "Resolve it yourself: rewrite app.py so it keeps print(\"hello\"), print(\"main was here\"), print(\"shipped\") and print(\"hotfix\") with no <<<<<<< markers left.",
        hints: [
          "echo 'print(\"hello\")' > app.py, then append the other three lines with >>.",
          "Git only accepts the resolution once the <<<<<<<, ======= and >>>>>>> lines are gone.",
        ],
        marks: 4,
        checks: [
          {
            type: "fileMatches" as const,
            path: "/home/student/project/app.py",
            pattern: "^(?![\\s\\S]*<<<<<<<)(?![\\s\\S]*>>>>>>>)(?![\\s\\S]*\\n=======\\n)[\\s\\S]*$",
            marks: 2,
          },
          { type: "fileContains" as const, path: "/home/student/project/app.py", value: "print(\"shipped\")", marks: 1 },
          { type: "fileContains" as const, path: "/home/student/project/app.py", value: "print(\"hotfix\")", marks: 1 },
        ],
      },
      {
        id: "s9",
        prompt: "Stage the resolved file — git add app.py — then finish the job: git merge --continue.",
        hints: [
          "git add tells Git the conflict is resolved.",
          "git merge --continue records the merge commit; watch for \"Merge branch 'feature'\" in the output.",
        ],
        marks: 4,
        checks: [
          { type: "outputContains" as const, value: "Merge branch 'feature'", marks: 2 },
          { type: "commandUsedWithFlag" as const, command: "git", flag: "--continue", marks: 2 },
        ],
      },
    ],
  },
  {
    id: "boss-project",
    title: "Boss Challenge: Ship the Project",
    difficulty: "hard" as const,
    tags: ["mixed", "everything"],
    brief:
      "Everything at once: build a structure, fill it, move things, find them, search them, lock them down. A realistic mini-project from empty disk to finished layout.",
    fs: {
      files: [
        { path: "/tmp/raw-notes.txt", content: "idea: compiler\nidea: shell\nDONE: parser\nDONE: lexer\nbug: segfault\n" },
      ],
      home: "/",
      user: "student",
    },
    steps: [
      {
        id: "s1",
        prompt: "Create the project layout: /project/src and /project/docs.",
        hints: ["mkdir -p project/src project/docs"],
        marks: 4,
        checks: [
          { type: "dirExists" as const, path: "/project/src", marks: 2 },
          { type: "dirExists" as const, path: "/project/docs", marks: 2 },
        ],
      },
      {
        id: "s2",
        prompt: "Copy raw-notes.txt from /tmp into /project/docs.",
        hints: ["cp /tmp/raw-notes.txt /project/docs/"],
        marks: 4,
        checks: [{ type: "fileExists" as const, path: "/project/docs/raw-notes.txt", marks: 4 }],
      },
      {
        id: "s3",
        prompt: "In one pipeline, count how many DONE items are in the notes.",
        hints: ["grep DONE file | wc -l"],
        marks: 4,
        checks: [
          { type: "outputEquals" as const, value: "2", marks: 3 },
          { type: "commandUsed" as const, commands: ["wc"], marks: 1 },
        ],
      },
      {
        id: "s4",
        prompt: "Save only the idea lines into /project/ideas.txt using a pipe and redirection.",
        hints: ["grep idea file > /project/ideas.txt"],
        marks: 4,
        checks: [
          { type: "fileContains" as const, path: "/project/ideas.txt", value: "idea: compiler", marks: 2 },
          { type: "fileContains" as const, path: "/project/ideas.txt", value: "idea: shell", marks: 2 },
        ],
      },
      {
        id: "s5",
        prompt: "Rename the notes in docs to meeting-notes.txt.",
        hints: ["mv docs/raw-notes.txt docs/meeting-notes.txt"],
        marks: 4,
        checks: [
          { type: "fileExists" as const, path: "/project/docs/meeting-notes.txt", marks: 2 },
          { type: "fileAbsent" as const, path: "/project/docs/raw-notes.txt", marks: 2 },
        ],
      },
      {
        id: "s6",
        prompt: "Clean up: remove the original /tmp/raw-notes.txt and make ideas.txt readable only by you (600).",
        hints: ["rm /tmp/raw-notes.txt && chmod 600 - but there is no && here; run two commands."],
        marks: 5,
        checks: [
          { type: "fileAbsent" as const, path: "/tmp/raw-notes.txt", marks: 2 },
          { type: "mode" as const, path: "/project/ideas.txt", mode: "600", marks: 3 },
        ],
      },
    ],
  },
];

export const LAUNCH_PROBLEMS: Problem[] = [
  ...rawProblems.map((p) => problemSchema.parse(p)),
  ...GIT_PRACTICE_PROBLEMS,
];

export function getLaunchProblem(id: string): Problem | undefined {
  return LAUNCH_PROBLEMS.find((p) => p.id === id);
}

/**
 * Tags that mark a problem as Git practice. The /git-problems page filters
 * on these, so any future problem that carries one of them shows up there
 * automatically — no per-page list to maintain.
 */
export const GIT_PROBLEM_TAGS = ["git", "config", "init", "add", "commit", "log", "branch", "remote"] as const;

/** Problems tagged for Git practice, in launch order. */
export function gitProblems(): Problem[] {
  return LAUNCH_PROBLEMS.filter((p) => p.tags.some((t) => (GIT_PROBLEM_TAGS as readonly string[]).includes(t)));
}
