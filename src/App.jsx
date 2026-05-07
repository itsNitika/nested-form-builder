import React, { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "nested-form-task-v4";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `q_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const createQuestion = () => ({
  id: uid(),
  text: "",
  type: "short_answer",
  answer: "True",
  children: [],
});

function normalizeQuestion(raw) {
  return {
    id: typeof raw?.id === "string" ? raw.id : uid(),
    text: typeof raw?.text === "string" ? raw.text : "",
    type: raw?.type === "true_false" ? "true_false" : "short_answer",
    answer: raw?.answer === "False" ? "False" : "True",
    children: Array.isArray(raw?.children) ? raw.children.map(normalizeQuestion) : [],
  };
}

function sanitizeQuestions(value) {
  if (!Array.isArray(value) || value.length === 0) return [createQuestion()];
  return value.map(normalizeQuestion);
}

function safeLoad() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [createQuestion()];
    return sanitizeQuestions(JSON.parse(raw));
  } catch {
    return [createQuestion()];
  }
}

function collectIds(tree, ids = []) {
  tree.forEach((q) => {
    ids.push(q.id);
    if (q.children?.length) collectIds(q.children, ids);
  });
  return ids;
}

function numberTree(list, prefix = "") {
  return list.map((q, idx) => {
    const current = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
    return {
      ...q,
      displayNumber: `Q${current}`,
      children: numberTree(q.children || [], current),
    };
  });
}

function getIdFromPath(tree, path) {
  let current = tree[path[0]];
  for (let i = 1; i < path.length; i += 1) {
    current = current.children[path[i]];
  }
  return current.id;
}

function updateById(tree, id, updater) {
  return tree.map((q) => {
    if (q.id === id) return updater(q);
    return { ...q, children: updateById(q.children || [], id, updater) };
  });
}

function addChildById(tree, id, childToAdd) {
  return tree.map((q) => {
    if (q.id === id) {
      return { ...q, children: [...(q.children || []), childToAdd] };
    }
    return { ...q, children: addChildById(q.children || [], id, childToAdd) };
  });
}

function removeById(tree, id) {
  return tree
    .filter((q) => q.id !== id)
    .map((q) => ({ ...q, children: removeById(q.children || [], id) }));
}

function moveTopLevel(list, index, direction) {
  const next = [...list];
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= next.length) return list;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function buildSubmissionTree(questions, answers) {
  return questions.map((q) => {
    const value = answers[q.id] ?? "";
    const node = {
      id: q.id,
      number: q.displayNumber,
      text: q.text || "Untitled question",
      type: q.type,
      answer: value,
      children: [],
    };

    if (q.type === "true_false" && value === "True" && q.children?.length) {
      node.children = buildSubmissionTree(q.children, answers);
    }

    return node;
  });
}

function TreePreview({ questions, showAnswers = false }) {
  if (!questions?.length) {
    return <div className="empty-state">No questions yet.</div>;
  }

  return (
    <div className="tree">
      {questions.map((q) => (
        <div key={q.id} className="tree-node">
          <div className="tree-title">
            {q.displayNumber}. {q.text || "Untitled question"}
          </div>
          <div className="tree-meta">
            Type: {q.type === "true_false" ? "True / False" : "Short Answer"}
            {showAnswers && q.type === "true_false" ? ` • Answer: ${q.answer || "—"}` : ""}
            {showAnswers && q.type === "short_answer" ? ` • Answer: ${q.answer || "—"}` : ""}
          </div>

          {q.children?.length > 0 && (
            <div className="tree-child">
              <TreePreview questions={q.children} showAnswers={showAnswers} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function QuestionCard({
  question,
  path,
  onUpdate,
  onDelete,
  onAddChild,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  depth = 0,
  registerRef,
}) {
  const isTrueFalse = question.type === "true_false";
  const canAddChild = isTrueFalse && question.answer === "True";

  return (
    <div
      ref={(el) => registerRef(question.id, el)}
      className="question-shell"
      style={{ marginLeft: depth > 0 ? 18 : 0 }}
    >
      <div className="question-card">
        <div className="question-top">
          <div className="question-number">{question.displayNumber}</div>

          <div className="question-main">
            <input
              value={question.text}
              onChange={(e) => onUpdate(path, { text: e.target.value })}
              placeholder="Type your question here..."
              className="question-input"
            />

            <div className="question-controls">
              <div className="control-group">
                <label>Question Type</label>
                <select
                  value={question.type}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    onUpdate(path, {
                      type: nextType,
                      answer: "True",
                      children: nextType === "true_false" ? question.children : [],
                    });
                  }}
                  className="question-select"
                >
                  <option value="short_answer">Short Answer</option>
                  <option value="true_false">True / False</option>
                </select>
              </div>

              {isTrueFalse && (
                <div className="control-group">
                  <label>Logic Answer</label>
                  <select
                    value={question.answer}
                    onChange={(e) =>
                      onUpdate(path, {
                        answer: e.target.value,
                        ...(e.target.value === "False" ? { children: [] } : {}),
                      })
                    }
                    className="question-select"
                  >
                    <option value="True">True (show child)</option>
                    <option value="False">False (hide child)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="icon-button danger"
            onClick={() => onDelete(path)}
            title="Delete question"
          >
            ×
          </button>
        </div>

        <div className="question-actions">
          {canAddChild && (
            <button type="button" className="secondary-button" onClick={() => onAddChild(path)}>
              + Add Sub-Question
            </button>
          )}

          {path.length === 1 && (
            <div className="move-group">
              <button
                type="button"
                className="ghost-button"
                onClick={() => onMoveUp(path)}
                disabled={!canMoveUp}
              >
                ↑ Up
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => onMoveDown(path)}
                disabled={!canMoveDown}
              >
                ↓ Down
              </button>
            </div>
          )}
        </div>
      </div>

      {question.children?.length > 0 && (
        <div className="nested-section">
          {question.children.map((child, idx) => (
            <QuestionCard
              key={child.id}
              question={child}
              path={[...path, idx]}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              canMoveUp={false}
              canMoveDown={false}
              depth={depth + 1}
              registerRef={registerRef}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [questions, setQuestions] = useState(() => safeLoad());
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(null);
  const [submitStatus, setSubmitStatus] = useState("");
  const [preview, setPreview] = useState(null);
  const [pendingScrollId, setPendingScrollId] = useState(null);

  const refsMap = useRef({});

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
  }, [questions]);

  useEffect(() => {
    const ids = new Set(collectIds(questions));
    setAnswers((prev) => {
      const next = {};
      for (const [k, v] of Object.entries(prev)) {
        if (ids.has(k)) next[k] = v;
      }
      return next;
    });
  }, [questions]);

  useEffect(() => {
    if (!pendingScrollId) return;
    const el = refsMap.current[pendingScrollId];
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      setPendingScrollId(null);
    }
  }, [questions, pendingScrollId]);

  const numberedQuestions = useMemo(() => numberTree(questions), [questions]);

  const registerRef = (id, el) => {
    if (el) refsMap.current[id] = el;
    else delete refsMap.current[id];
  };

  const handleUpdate = (path, patch) => {
    const id = getIdFromPath(questions, path);
    setQuestions((prev) => updateById(prev, id, (q) => ({ ...q, ...patch })));
  };

  const handleDelete = (path) => {
    const id = getIdFromPath(questions, path);
    setQuestions((prev) => removeById(prev, id));
  };

  const handleAddChild = (path) => {
    const parentId = getIdFromPath(questions, path);
    const newChild = createQuestion();
    setQuestions((prev) => addChildById(prev, parentId, newChild));
    setPendingScrollId(newChild.id);
  };

  const handleMove = (path, direction) => {
    if (path.length !== 1) return;
    setQuestions((prev) => moveTopLevel(prev, path[0], direction));
  };

  const handleAddParent = () => {
    const newParent = createQuestion();
    setQuestions((prev) => [...prev, newParent]);
    setPendingScrollId(newParent.id);
  };

  const handleReset = () => {
    if (!window.confirm("Reset the whole form?")) return;
    setQuestions([createQuestion()]);
    setAnswers({});
    setSubmitted(null);
    setSubmitStatus("");
    setPreview(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handlePreview = () => {
    setPreview(numberedQuestions);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const result = buildSubmissionTree(numberedQuestions, answers);
    setSubmitted(result);
    setSubmitStatus("Form successfully submitted");
  };

  return (
    <div className="page-shell">
     <style>{`
  * { box-sizing: border-box; }
  html, body, #root { height: 100%; }
  body {
    margin: 0;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background:
      radial-gradient(circle at top left, rgba(99,102,241,.28), transparent 26%),
      radial-gradient(circle at top right, rgba(16,185,129,.16), transparent 20%),
      linear-gradient(180deg, #0b1020 0%, #0f172a 48%, #111827 100%);
    color: #e5e7eb;
  }
  button, input, select { font: inherit; }
  .page-shell {
    min-height: 100vh;
    padding: 28px 16px 120px;
  }
  .container {
    max-width: 1320px;
    margin: 0 auto;
  }
  .hero {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.08);
    background: rgba(15, 23, 42, .62);
    backdrop-filter: blur(18px);
    border-radius: 28px;
    padding: 28px 24px 24px;
    box-shadow: 0 24px 70px rgba(0,0,0,.32);
    margin-bottom: 20px;
    text-align: center;
  }
  .hero h1 {
    margin: 8px 0 10px;
    font-size: clamp(32px, 4.8vw, 58px);
    line-height: .98;
    letter-spacing: -0.05em;
    background: linear-gradient(90deg, #f8fafc 0%, #c4b5fd 40%, #60a5fa 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .hero p {
    max-width: 840px;
    margin: 0 auto;
    color: #94a3b8;
    font-size: 15px;
    line-height: 1.7;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    justify-content: center;
    align-items: center;
    margin-top: 18px;
  }

  .toolbar button {
    min-height: 48px;
    padding: 12px 18px;
    border-radius: 16px;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
  }

  .layout {
    display: grid;
    grid-template-columns: 1.55fr .95fr;
    gap: 20px;
    align-items: start;
  }
  .panel {
    border-radius: 28px;
    border: 1px solid rgba(255,255,255,.08);
    background: rgba(15, 23, 42, .74);
    backdrop-filter: blur(18px);
    box-shadow: 0 20px 60px rgba(0,0,0,.24);
    overflow: hidden;
  }
  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 20px 20px 0;
    flex-wrap: wrap;
  }
  .panel-head h2 {
    margin: 0;
    font-size: 20px;
    color: #f8fafc;
  }
  .counter {
    font-size: 12px;
    color: #cbd5e1;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.08);
    padding: 7px 12px;
    border-radius: 999px;
  }
  .panel-body {
    padding: 20px;
  }

  .card-stack {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .question-shell {
    position: relative;
  }
  .question-card {
    position: relative;
    overflow: hidden;
    border-radius: 24px;
    border: 1px solid rgba(255,255,255,.10);
    background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03));
    padding: 18px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
  }
  .question-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(180deg, #6366f1, #22c55e);
    opacity: .85;
  }
  .question-top {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 14px;
    align-items: start;
  }
  .question-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 58px;
    height: 42px;
    padding: 0 14px;
    border-radius: 14px;
    background: linear-gradient(135deg, #6366f1, #818cf8);
    color: white;
    font-weight: 800;
    box-shadow: 0 10px 22px rgba(99,102,241,.25);
  }
  .question-main { min-width: 0; }

  .question-input, .question-select, .fill-input, .fill-select, .share-input {
    width: 100%;
    border-radius: 16px;
    border: 1px solid rgba(148,163,184,.22);
    background: rgba(15, 23, 42, .75);
    color: #f8fafc;
    outline: none;
    transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
  }
  .question-input, .fill-input, .share-input {
    padding: 14px 16px;
    font-size: 15px;
    margin-bottom: 14px;
  }
  .question-input::placeholder, .fill-input::placeholder, .share-input::placeholder {
    color: #64748b;
  }
  .question-input:focus, .question-select:focus, .fill-input:focus, .fill-select:focus, .share-input:focus {
    border-color: rgba(129,140,248,.95);
    box-shadow: 0 0 0 4px rgba(99,102,241,.18);
  }

  .question-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .control-group label {
    display: block;
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: #94a3b8;
  }
  .question-select, .fill-select {
    padding: 13px 14px;
  }

  .question-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 14px;
    flex-wrap: wrap;
  }

  .secondary-button, .ghost-button, .primary-button, .preview-button, .reset-button, .fill-submit-button {
    border: 0;
    cursor: pointer;
    transition: transform .2s ease, box-shadow .2s ease, background .2s ease, opacity .2s ease;
  }
  .secondary-button:hover, .ghost-button:hover, .primary-button:hover, .preview-button:hover, .reset-button:hover, .fill-submit-button:hover {
    transform: translateY(-1px);
  }

  .secondary-button {
    padding: 11px 16px;
    border-radius: 14px;
    background: rgba(16,185,129,.12);
    border: 1px solid rgba(16,185,129,.32);
    color: #6ee7b7;
    font-weight: 700;
  }
  .secondary-button:hover { background: rgba(16,185,129,.18); }

  .move-group {
    display: flex;
    gap: 10px;
  }
  .ghost-button {
    padding: 11px 14px;
    border-radius: 14px;
    background: rgba(255,255,255,.05);
    color: #e2e8f0;
    border: 1px solid rgba(255,255,255,.08);
    font-weight: 700;
  }
  .ghost-button:disabled {
    opacity: .35;
    cursor: not-allowed;
    transform: none;
  }

  .icon-button {
    width: 42px;
    height: 42px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.05);
    color: #e2e8f0;
    font-size: 26px;
    line-height: 1;
    flex: 0 0 auto;
  }
  .icon-button.danger:hover {
    color: #fb7185;
    border-color: rgba(251,113,133,.35);
    background: rgba(251,113,133,.08);
  }

  .nested-section {
    margin-top: 14px;
    margin-left: 18px;
    padding-left: 18px;
    border-left: 2px solid rgba(129,140,248,.32);
    display: grid;
    gap: 14px;
  }

  .preview-button {
    background: linear-gradient(135deg, #10b981, #06b6d4);
    color: white;
    padding: 12px 16px;
    border-radius: 16px;
    font-weight: 800;
    box-shadow: 0 14px 26px rgba(16,185,129,.20);
  }
  .reset-button {
    background: rgba(255,255,255,.06);
    color: #e2e8f0;
    padding: 12px 16px;
    border-radius: 16px;
    font-weight: 700;
    border: 1px solid rgba(255,255,255,.10);
  }
  .fill-submit-button {
    background: linear-gradient(135deg, #8b5cf6, #ec4899);
    color: white;
    padding: 13px 18px;
    border-radius: 16px;
    font-weight: 800;
    box-shadow: 0 14px 30px rgba(139,92,246,.20);
  }

  .preview-box {
    margin-top: 18px;
    border-radius: 22px;
    background: rgba(2,6,23,.48);
    border: 1px solid rgba(148,163,184,.14);
    padding: 16px;
    overflow: hidden;
  }
  .empty-state {
    color: #94a3b8;
    padding: 8px 0;
    line-height: 1.6;
  }

  .tree {
    display: grid;
    gap: 12px;
  }
  .tree-node {
    border-radius: 18px;
    background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.08);
    padding: 14px;
  }
  .tree-title {
    font-weight: 800;
    color: #f8fafc;
    line-height: 1.5;
  }
  .tree-meta {
    margin-top: 6px;
    color: #94a3b8;
    font-size: 13px;
  }
  .tree-child {
    margin-top: 12px;
    padding-left: 14px;
    border-left: 2px solid rgba(148,163,184,.22);
  }

  .submit-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 18px;
  }

  .floating-actions {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 100;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .fill-card {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 14px;
    align-items: start;
    border-radius: 24px;
    border: 1px solid rgba(255,255,255,.10);
    background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03));
    padding: 18px;
    position: relative;
  }
  .fill-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(180deg, #6366f1, #22c55e);
    opacity: .85;
    border-top-left-radius: 24px;
    border-bottom-left-radius: 24px;
  }
  .fill-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 56px;
    height: 42px;
    padding: 0 14px;
    border-radius: 14px;
    background: linear-gradient(135deg, #6366f1, #818cf8);
    color: white;
    font-weight: 800;
    box-shadow: 0 10px 22px rgba(99,102,241,.25);
  }
  .fill-main {
    min-width: 0;
  }
  .fill-input, .fill-select {
    margin-top: 12px;
  }
  .fill-form-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 18px;
  }

  .success-badge {
    margin-bottom: 12px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(34,197,94,.30);
    background: rgba(34,197,94,.10);
    color: #86efac;
    font-weight: 800;
  }

  @media (max-width: 980px) {
    .layout { grid-template-columns: 1fr; }
  }

 @media (max-width: 720px) {
  .hero,
  .panel-body,
  .panel-head {
    padding-left: 16px;
    padding-right: 16px;
  }

  .question-top {
    grid-template-columns: 1fr;
  }

  .question-controls {
    grid-template-columns: 1fr;
  }

  .move-group {
    width: 100%;
  }

  .ghost-button {
    flex: 1;
  }

  .floating-actions {
    left: 16px;
    right: 16px;
    bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .floating-actions button {
    width: 100%;
    padding: 14px;
    font-size: 15px;
    white-space: normal;
  }

  .fill-card {
    grid-template-columns: 1fr;
  }
}
`}</style>

      <div className="container">
        <div className="hero">
          <h1>Nested Form Builder</h1>
          <p>
            Add parent questions, create nested child questions for True/False logic, reorder parent questions,
            and submit the full hierarchy in a clean preview view.
          </p>

          <div className="toolbar">
            <button type="button" className="primary-button" onClick={handleAddParent}>
              + Add New Parent Question
            </button>
            <button type="button" className="reset-button" onClick={handleReset}>
              Reset Form
            </button>
            <button type="button" className="preview-button" onClick={handlePreview}>
              Refresh Preview
            </button>
          </div>
        </div>

        <div className="layout">
          <section className="panel">
            <div className="panel-head">
              <h2>Questions Builder</h2>
              <div className="counter">{numberedQuestions.length} top-level question(s)</div>
            </div>

            <div className="panel-body">
              <form onSubmit={handleSubmit}>
                <div className="card-stack">
                  {numberedQuestions.map((q, idx) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      path={[idx]}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      onAddChild={handleAddChild}
                      onMoveUp={(path) => handleMove(path, "up")}
                      onMoveDown={(path) => handleMove(path, "down")}
                      canMoveUp={idx > 0}
                      canMoveDown={idx < numberedQuestions.length - 1}
                      registerRef={registerRef}
                    />
                  ))}
                </div>

                <div className="submit-actions">
                  <button type="submit" className="fill-submit-button">
                    Submit Form
                  </button>
                </div>
              </form>
            </div>
          </section>

          <aside className="panel">
            <div className="panel-head">
              <h2>Current Structure</h2>
              <div className="counter">Live hierarchy</div>
            </div>
            <div className="panel-body">
              <div className="preview-box">
                {preview ? (
                  <TreePreview questions={preview} />
                ) : (
                  <div className="empty-state">
                    Click <b>Refresh Preview</b> to see the current hierarchy.
                  </div>
                )}
              </div>

              <div style={{ marginTop: 18 }}>
                <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Submitted Response</h2>
                <div className="preview-box">
                  {submitStatus && <div className="success-badge">{submitStatus}</div>}
                  {submitted ? (
                    <TreePreview questions={submitted} showAnswers />
                  ) : (
                    <div className="empty-state">
                      Submit the form to see the filled response here.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* {questions.length > 0 && (
  <div className="floating-actions">
    <button type="button" className="primary-button" onClick={handleAddParent}>
      + Add Parent
    </button>

    <button type="button" className="preview-button" onClick={handlePreview}>
      Preview
    </button>
  </div>
)} */}
    </div>
  );
}