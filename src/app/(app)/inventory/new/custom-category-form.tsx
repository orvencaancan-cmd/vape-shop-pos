"use client";

import { useActionState, useState } from "react";
import { createCustomCategoryAction, type ActionState } from "../actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

type TagType = "none" | "freeText" | "checklist";

export function NewCustomCategoryForm() {
  const [state, formAction, pending] = useActionState(createCustomCategoryAction, initialState);
  const [tagType, setTagType] = useState<TagType>("none");
  const [rows, setRows] = useState<number[]>([0]);
  const [nextRowId, setNextRowId] = useState(1);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <label className="flex flex-col gap-1.5">
        <Label>Category name</Label>
        <Input name="label" placeholder="e.g. Pins" required />
      </label>

      <div>
        <Label>Does each item need an extra tag?</Label>
        <p className="mt-1 text-xs text-muted">
          Like Flavor on e-juice or Gauge on Wire — optional, and shown as whatever you name it.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {(
            [
              { value: "none", label: "No, just the name" },
              { value: "freeText", label: "Yes — typed in free-form" },
              { value: "checklist", label: "Yes — chosen from a list I define" },
            ] as { value: TagType; label: string }[]
          ).map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="variantInputType"
                value={opt.value}
                checked={tagType === opt.value}
                onChange={() => setTagType(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {tagType !== "none" && (
        <label className="flex flex-col gap-1.5">
          <Label>What do you want to call the tag?</Label>
          <Input name="variantLabel" placeholder="e.g. Size" required />
        </label>
      )}

      {tagType === "checklist" && (
        <div>
          <Label>Options</Label>
          <p className="mt-1 text-xs text-muted">One option per line.</p>
          <div className="mt-2 flex flex-col gap-2">
            {rows.map((rowId, i) => (
              <div key={rowId} className="flex items-center gap-2">
                <Input name="variantOptions" placeholder={`Option ${i + 1}`} />
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRows((r) => r.filter((x) => x !== rowId))}
                    className="shrink-0 text-xs text-muted hover:text-error"
                    aria-label="Remove row"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setRows((r) => [...r, nextRowId]);
              setNextRowId((n) => n + 1);
            }}
            className="mt-2 text-xs text-primary underline underline-offset-2"
          >
            + Add another
          </button>
        </div>
      )}

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create category"}
      </Button>
    </form>
  );
}
