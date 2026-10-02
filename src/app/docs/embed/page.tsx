import SiteHeader from "@/components/SiteHeader";
import CodeBlock from "@/components/CodeBlock";

export const metadata = {
  title: "Terminal Trainer: embed guide",
  description:
    "Drop Terminal Trainer into any college website with one iframe and a small postMessage API.",
};

export default function EmbedDocsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-6 pb-16 pt-10 text-sm leading-relaxed">
        <header>
          <h1 className="font-mono text-2xl font-bold">Embedding Terminal Trainer</h1>
          <p className="prose-body mt-3 text-term-muted">
            Terminal Trainer is designed to drop into any college website —
            WordPress, Moodle, Drupal, or a custom LMS — via an iframe plus a
            small postMessage API. Your site owns the students; this owns the
            practice environment and grading.
          </p>
        </header>

        <section>
          <h2 className="text-lg font-semibold">1. Embed the widget</h2>
          <p className="prose-body mt-1 text-term-text/70">
            Point the iframe at <code>/embed</code>. Query params: <code>?problem=&lt;id&gt;</code> to
            preselect a problem, <code>?student=&lt;id&gt;</code> to namespace saved progress,
            <code> &amp;compact=1</code> for a tighter layout.
          </p>
          <CodeBlock>{IFRAME_SNIPPET}</CodeBlock>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Receive marks (postMessage)</h2>
          <p className="prose-body mt-1 text-term-text/70">
            The widget posts these messages to its parent window:
          </p>
          <ul className="ml-5 list-disc space-y-1 text-term-text/70">
            <li><code>tt:ready</code> — the widget is up; includes the problem list.</li>
            <li><code>tt:step:completed</code> — a step&apos;s checks all passed (includes marks so far).</li>
            <li><code>tt:problem:completed</code> — the whole problem is done; store <code>earned/max</code> against your student.</li>
            <li><code>tt:progress</code> — periodic progress snapshots.</li>
          </ul>
          <CodeBlock>{HOST_SNIPPET}</CodeBlock>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Control the widget</h2>
          <p className="prose-body mt-1 text-term-text/70">
            Send messages <em>into</em> the iframe to configure it at runtime:
          </p>
          <CodeBlock>{CONTROL_SNIPPET}</CodeBlock>
          <p className="prose-body mt-2 text-term-text/70">
            <code>tt:init</code> accepts <code>studentId</code> and <code>problemId</code> (pick
            one from the <code>tt:ready</code> list or <code>?problem=</code>). Inline host-authored
            <code> problem</code> JSON is <strong>not accepted</strong>: the widget rejects it
            outright, so a remote page cannot author content through the embed.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Author your own problems</h2>
          <p className="prose-body mt-1 text-term-text/70">
            Problems are JSON: a brief, an initial filesystem, and ordered steps — each step has
            marks and checks (file exists, file contains, mode, output equals, command used…).
            The schema is enforced end-to-end, and every problem ships with machine-checked
            solutions. Full schema reference: <code>src/engine/schema.ts</code>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Roles and permissions</h2>
          <p className="prose-body mt-1 text-term-text/70">
            The platform distinguishes teachers and students at the data layer: teachers hold
            <code> problem:create</code>, <code>testcase:upload</code>, <code>quiz:create</code>,
            <code> assignment:grade</code> capabilities; students hold only
            <code> content:view</code>, <code>content:answer</code>, and
            <code> progress:viewOwn</code>. Every mutation path checks these with typed guards
            (see <code>src/roles/</code>), and the teacher console demonstrates the walls live.
            The live app computes your role <em>server-side</em> from deploy-time allowlists
            (<code>src/server/authz.ts</code>, exposed on <code>/api/me</code>) — there is no API
            for authoring content at all: <code>/api/*</code> is deny-by-default
            (<code>src/server/api-allowlist.ts</code>), and the console&apos;s role switcher is a
            local demo that never leaves your browser.
          </p>
        </section>
      </main>
    </>
  );
}

const IFRAME_SNIPPET = `<iframe
  id="tt-widget"
  src="https://your-trainer.example.com/embed?problem=grep-search&student=\${STUDENT_ID}"
  style="width:100%;height:600px;border:0;border-radius:8px"
  title="Terminal Trainer"
></iframe>`;

const HOST_SNIPPET = `window.addEventListener("message", (event) => {
  if (typeof event.data !== "object" || !event.data.type?.startsWith("tt:")) return;

  switch (event.data.type) {
    case "tt:problem:completed":
      // event.data = { problemId, earned, max, durationMs, studentId? }
      fetch("/api/save-score", {
        method: "POST",
        body: JSON.stringify({
          studentId: CURRENT_STUDENT_ID,
          problemId: event.data.problemId,
          score: event.data.earned,
          maxScore: event.data.max,
        }),
      });
      break;
    case "tt:step:completed":
      console.log("step done", event.data.stepId, event.data.earned);
      break;
  }
});`;

const CONTROL_SNIPPET = `const frame = document.getElementById("tt-widget");

// Assign a built-in problem to this student
// (inline host-authored problem JSON is rejected by the widget)
frame.contentWindow.postMessage(
  { type: "tt:init", studentId: "roll-42", problemId: "chmod-permissions" },
  "*"
);

// Start over
frame.contentWindow.postMessage({ type: "tt:reset" }, "*");`;
