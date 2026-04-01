import { useState } from "react";
import { useNavigate } from "react-router-dom";

const KillSwitchPage = () => {
  const [clicks, setClicks] = useState(0);
  const navigate = useNavigate();

  const handleClick = () => {
    const next = clicks + 1;
    setClicks(next);
    if (next >= 7) {
      navigate("/admin");
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <h1
        className="text-4xl font-bold text-black cursor-default select-none"
        onClick={handleClick}
      >
        Hello World
      </h1>
    </div>
  );
};

export default KillSwitchPage;
