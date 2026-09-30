/**
 * Theory content shared between the home page cards (TheoryNotes) and the
 * related-theory sidebar on /play pages (RelatedTheorySidebar).
 *
 * THEORY_LINKS maps each launch-problem id to the theory topic ids that are
 * relevant to it — the sidebar uses this to decide what to show. Topic ids
 * double as URL hashes: /#theory-<id> opens that card on the home page.
 */

export type TheoryTopic = {
  id: string;
  icon: string;
  iconColor: string;
  title: string;
  summary: string;
  points: string[];
  practiceHref?: string;
  practiceLabel?: string;
};

export const THEORY_TOPICS: TheoryTopic[] = [
  {
    id: "shell",
    icon: ">_",
    iconColor: "text-term-green",
    title: "The shell & CLI",
    summary: "What the prompt is, how a command line is read, and the pieces of a command.",
    points: [
      "The shell is a program that reads a line of text, parses it, and runs a program. The prompt (student@trainer:~$) means the shell is ready for input — it shows who you are and where you are.",
      "Every line follows the same shape: command [options] [arguments]. Options (also called flags) usually start with a dash and modify behaviour, e.g. ls -l. Arguments are what the command acts on, e.g. ls -l notes.",
      "A dash alone means short flags (ls -a), double dashes mean long flags (ls --all). Many flags can be combined: ls -la. Order usually doesn't matter.",
      "Press Enter to run; Ctrl+C kills a running command. Anything the command prints is called its output.",
      "The shell is case-sensitive: Downloads.txt and downloads.txt are different names.",
    ],
  },
  {
    id: "filesystem",
    icon: "⌂",
    iconColor: "text-term-blue",
    title: "The filesystem & paths",
    summary: "Directories, the directory tree, absolute vs relative paths, . and ..",
    points: [
      "Everything lives in one tree with the root directory / at the top. A directory is a folder — it can contain files and other directories.",
      "Your home directory (~, e.g. /home/student) is where you land after login. The directory you are currently inside is the working directory; pwd prints it.",
      "An absolute path starts from the root (e.g. /home/student/notes/todo.txt) and works from anywhere. A relative path starts from where you are (e.g. notes/todo.txt).",
      "In every directory, . means 'this directory' and .. means 'the parent (one level up)'. So cd .. moves up, and ../sibling.txt points next door.",
      "cd changes directory, ls lists contents (ls -a also shows hidden dot-files like .bashrc).",
    ],
    practiceHref: "/play/pwd-navigate",
    practiceLabel: "Practice: Finding Your Way",
  },
  {
    id: "files",
    icon: "▤",
    iconColor: "text-term-yellow",
    title: "Files: create, read, copy, move, delete",
    summary: "touch, cat, cp, mv, rm, mkdir, rmdir — the everyday file-management verbs.",
    points: [
      "Create an empty file with touch file.txt; create a directory with mkdir name (mkdir -p a/b makes nested dirs in one go).",
      "Read a file with cat file.txt. cat also concatenates: cat a.txt b.txt prints both back to back.",
      "Copy with cp source dest, copy into a directory with cp file dir/, copy recursively with cp -r dir/ copy-of-dir. Move (or rename) with mv old new — same operation, different use.",
      "Delete with rm file. rm -r deletes a directory and everything inside it; there is no recycle bin, so this is the one to be careful with. rmdir only removes empty directories.",
      "Redirection changes where output goes: > writes to a file (overwrite), >> appends. grep pattern file searches inside files — grep -c counts matching lines.",
    ],
    practiceHref: "/play/mkdir-touch",
    practiceLabel: "Practice: Building Your Workspace",
  },
  {
    id: "permissions",
    icon: "🔒",
    iconColor: "text-term-violet",
    title: "Permissions & chmod",
    summary: "Reading rwx strings, user/group/other, numeric and symbolic chmod.",
    points: [
      "Every file has an owner (user), a group, and permissions for three audiences: the user (u), the group (g), and others (o). ls -l shows them as a 10-character string: -rw-r--r-- — first char is the type (- file, d directory), then three triplets of r, w, x.",
      "r = read (view contents), w = write (modify), x = execute (run a program or enter a directory). - means the permission is absent.",
      "Each triplet is really 3 bits, so 7 = rwx, 6 = rw-, 5 = r-x, 4 = r--. That gives chmod 600 file → rw------- (owner read/write, nobody else) and chmod 755 script.sh → rwxr-xr-x.",
      "Symbolic form: chmod u+x adds execute for the user, chmod go-rwx strips everything from group and others, chmod a+r gives everyone read. ugoa pick who, +-= add/remove/set, rwx pick what.",
      "If a permission is missing, the kernel refuses the action — e.g. no w means you can't edit the file, no x on a directory means you can't cd into it.",
    ],
    practiceHref: "/play/chmod-permissions",
    practiceLabel: "Practice: Locking It Down",
  },
  {
    id: "git",
    icon: "⑂",
    iconColor: "text-term-red",
    title: "Git in five commands",
    summary: "The three areas (working dir → staging → history) and the core workflow.",
    points: [
      "A Git repository is just a folder that Git tracks. git init creates one (a hidden .git/ folder appears); git clone copies an existing one.",
      "Changes travel through three areas: the working directory (your files as they are), the staging area (git add — the snapshot you are building), and the history (commits).",
      "git status is your friend — it shows which branch you're on and what is modified or staged. git add file.txt stages one file; git add . stages everything in the current directory.",
      "git commit -m \"message\" records the staged snapshot permanently. Commit messages should say what and why: 'Fix login redirect' not 'changes'.",
      "git log shows history (newest first); git diff shows unstaged changes; git diff --staged reviews what is about to be committed. Branches (git branch, git checkout) let you try ideas without touching main.",
    ],
  },
  {
    id: "pipes",
    icon: "|",
    iconColor: "text-term-blue",
    title: "Pipes & filters",
    summary: "Chaining commands: |, grep, head/tail, wc — the classic Unix trick.",
    points: [
      "Pipes send the output of one command straight into the input of the next: ls -la | grep notes shows only lines containing 'notes'. Compare redirection (>) which sends output to a file instead.",
      "grep PATTERN searches line by line. grep -i ignores case, grep -n shows line numbers, grep -c counts matching lines.",
      "head -n 5 prints the first 5 lines, tail -n 5 the last. tail -f follows a growing file — handy for logs.",
      "wc counts lines, words and characters: wc -l file.txt counts lines only.",
      "Pipes chain: cat access.log | grep ERROR | wc -l counts the errors. Each stage does one small job — that's the Unix philosophy.",
    ],
    practiceHref: "/play/grep-search",
    practiceLabel: "Practice: Searching with grep",
  },
];

/**
 * problem id → related theory topic ids, most relevant first.
 * Unknown problem ids fall back to ["shell"] via relatedTheoryFor().
 */
export const THEORY_LINKS: Record<string, string[]> = {
  "pwd-navigate": ["filesystem", "shell"],
  "ls-inspect": ["filesystem", "shell"],
  "mkdir-touch": ["files", "filesystem"],
  "cp-mv-rename": ["files"],
  "rm-cleanup": ["files"],
  "grep-search": ["pipes", "shell"],
  "find-redirect": ["files", "pipes"],
  "chmod-permissions": ["permissions"],
  "boss-project": ["files", "filesystem", "permissions", "pipes"],
};

/** Theory topics for a problem id, in display order. Unknown ids get the CLI basics. */
export function relatedTheoryFor(problemId: string): TheoryTopic[] {
  const ids = THEORY_LINKS[problemId] ?? ["shell"];
  return ids
    .map((id) => THEORY_TOPICS.find((t) => t.id === id))
    .filter((t): t is TheoryTopic => Boolean(t));
}

/**
 * Home-page link for a theory topic. The `theory` query param drives the
 * open-card state through Next.js soft navigations (useSearchParams in
 * TheoryNotes); the hash keeps the URL shareable and gives the browser an
 * anchor target.
 */
export function theoryHref(topicId: string): string {
  return `/?theory=${topicId}#theory-${topicId}`;
}
