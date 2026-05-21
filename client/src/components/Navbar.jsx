import { Link } from "react-router-dom";
import {
  ShoppingCart,
  User,
  Moon,
  Sun
} from "lucide-react";

function Navbar() {

  const toggleTheme = () => {
    document.body.classList.toggle("light-theme");
  };

  return (
    <nav
      className="glass"
      style={{
        position:"sticky",
        top:0,
        zIndex:1000,
        padding:"18px 0"
      }}
    >
      <div
        className="container"
        style={{
          display:"flex",
          justifyContent:"space-between",
          alignItems:"center"
        }}
      >

        <h1
          className="gradient-text"
          style={{
            fontSize:"34px",
            fontWeight:"800"
          }}
        >
          FASHORA
        </h1>

        <div
          style={{
            display:"flex",
            gap:"30px",
            alignItems:"center"
          }}
        >

          <Link to="/">Home</Link>

          <Link to="/login">
            <User size={22}/>
          </Link>

          <ShoppingCart size={22}/>

          <button
            onClick={toggleTheme}
            className="theme-btn"
          >
            <Moon size={18}/>
          </button>

        </div>

      </div>
    </nav>
  );
}

export default Navbar;