import "./App.css"

const App = () => {
  return (
    <div
      data-theme="abyss"
      className="mx-auto overflow-hidden md:max-w-2xl w-full absolute inset-0"
    >
      <div className="navbar gap-2">
        <div className="navbar-start flex-0">
          <a className="btn btn-ghost text-lg uppercase">cineblazed</a>
        </div>
        <div className="navbar-center flex-1">
          {/* search */}
          <input
            className="input input-ghost flex-1 transition-all"
            type="text"
            placeholder="Search for stuff..."
          />
        </div>
      </div>
    </div>
  )
}

export default App
