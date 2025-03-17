import { color } from "@material-tailwind/react/types/components/spinner";
import { useState, useEffect } from "react";

export function useSpinnerColor(defaultColor: color = "blue") {
  const [spinnerColor, setSpinnerColor] = useState<color| undefined>(undefined);

  useEffect(() => {
    setSpinnerColor(document.documentElement.classList.contains("dark") ? defaultColor : undefined);
  }, [defaultColor]);

  return spinnerColor;
}
