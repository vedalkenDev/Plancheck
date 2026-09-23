"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { phaseThemeChange } from "@/lib/theme-phase";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  function toggleTheme() {
    const next = resolvedTheme === "light" ? "dark" : "light";
    phaseThemeChange(() => {
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.style.colorScheme = next;
      setTheme(next);
    });
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Toggle dark and light mode"
          onClick={toggleTheme}
        >
          <span className="grid size-4 place-items-center">
            <Sun className="col-start-1 row-start-1 opacity-100 dark:opacity-0" />
            <Moon className="col-start-1 row-start-1 opacity-0 dark:opacity-100" />
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Dark / light mode</TooltipContent>
    </Tooltip>
  );
}
