/**
 * Launch problem set for first-year CS students.
 * Authored content: 9 problems from navigation to a boss challenge.
 * Pure TypeScript (data) so it can be imported anywhere.
 */
import { problemSchema, type Problem } from "@/engine/schema";

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

export const LAUNCH_PROBLEMS: Problem[] = rawProblems.map((p) => problemSchema.parse(p));

export function getLaunchProblem(id: string): Problem | undefined {
  return LAUNCH_PROBLEMS.find((p) => p.id === id);
}
