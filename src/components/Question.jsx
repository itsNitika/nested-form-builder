export default function Question({
  item,
  number,
  questions,
  setQuestions,
  updateQuestion,
  addChildQuestion,
  deleteQuestion,
}) {
  return (
    <div className="question-box">
      <h3>Q{number}</h3>

      <input
        type="text"
        placeholder="Enter Question"
        value={item.text}
        onChange={(e) =>
          setQuestions(
            updateQuestion(questions, item.id, 'text', e.target.value)
          )
        }
      />

      <select
        value={item.type}
        onChange={(e) =>
          setQuestions(
            updateQuestion(questions, item.id, 'type', e.target.value)
          )
        }
      >
        <option value="short">Short Answer</option>
        <option value="tf">True/False</option>
      </select>

      {item.type === 'tf' && (
        <select
          value={item.answer}
          onChange={(e) =>
            setQuestions(
              updateQuestion(questions, item.id, 'answer', e.target.value)
            )
          }
        >
          <option value="false">False</option>
          <option value="true">True</option>
        </select>
      )}

      <div className="btn-group">
        {item.type === 'tf' && item.answer === 'true' && (
          <button
            className="child-btn"
            onClick={() =>
              setQuestions(addChildQuestion(questions, item.id))
            }
          >
            Add Child Question
          </button>
        )}

        <button
          className="delete-btn"
          onClick={() =>
            setQuestions(deleteQuestion(questions, item.id))
          }
        >
          Delete
        </button>
      </div>

      {item.children.map((c, i) => (
        <div className="child-wrapper" key={c.id}>
          <Question
            item={c}
            number={`${number}.${i + 1}`}
            questions={questions}
            setQuestions={setQuestions}
            updateQuestion={updateQuestion}
            addChildQuestion={addChildQuestion}
            deleteQuestion={deleteQuestion}
          />
        </div>
      ))}
    </div>
  )
}