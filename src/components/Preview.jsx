export default function Preview({ item, number }) {
  return (
    <div className="preview-item">
      <p>
        <strong>Q{number}:</strong> {item.text}
      </p>

      {item.children.map((c, i) => (
        <div className="preview-child" key={c.id}>
          <Preview
            item={c}
            number={`${number}.${i + 1}`}
          />
        </div>
      ))}
    </div>
  )
}