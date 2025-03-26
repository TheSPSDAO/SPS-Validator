import { color } from "@material-tailwind/react/types/components/spinner";
import { useState, useEffect } from "react";

export function useSpinnerColor(defaultColor: color = "blue") {
  const isDarkMode = document.documentElement.classList.contains("dark");
  const [spinnerColor, setSpinnerColor] = useState<color | undefined>(
    isDarkMode ? defaultColor : undefined
  );

  useEffect(() => {
    if (document.documentElement.classList.contains("dark")) {
      setSpinnerColor(defaultColor);
    } else {
      setSpinnerColor(undefined);
    }
  }, [defaultColor]);

  return spinnerColor;
}
