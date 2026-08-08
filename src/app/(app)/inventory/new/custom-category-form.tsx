"use client";

import { useActionState, useState } from "react";
import { createCustomCategoryAction, type ActionState } from "../actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

type TagType = "none" | "freeText" | "checklist";

// Shared by both tag 1 and tag 2 -- tag 1 always allows "no tag"; tag 2 only
// ever renders once the owner has opted into it, so it skips straight to
// picking free-form vs. a defined list.
function TagFields({
  suffix,
  title,
  helpText,
  allowNone,
  tagType,
  onTagTypeChange,
}: {
  suffix: "" | "2";
  title: string;
  helpText: string;
  allowNone: boolean;
  tagType: TagType;
  onTagTypeChange: (t: TagType) => void;
}) {
  const [rows, setRows] = useState<number[]>([0]);
  const [nextRowId, setNextRowId] = useState(1);

  const options: { value: TagType; label: string }[] = [
    ...(allowNone ? [{ value: "none" as const, label: "No, just the name" }] : []),
    { value: "freeText", label: "Yes — typed in free-form" },
    { value: "checklist", label: "Yes — chosen from a list I define" },
  ];

  return (
    <div>
      <Label>{title}</Label>
      <p className="mt-1 text-xs text-muted">{helpText}</p>
      <div className="mt-2 flex flex-col gap-2">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              name={`variantInputType${suffix}`}
              value={opt.value}
              checked={tagType === opt.value}
              onChange={() => onTagTypeChange(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>

      {tagType !== "none" && (
        <label className="mt-3 flex flex-col gap-1.5">
          <Label>What do you want to call the tag?</Label>
          <Input name={`variantLabel${suffix}`} placeholder="e.g. Size" required />
        </label>
      )}

      {tagType === "checklist" && (
        <div className="mt-3">
          <Label>Options</Label>
          <p className="mt-1 text-xs text-muted">One option per line.</p>
          <div className="mt-2 flex flex-col gap-2">
            {rows.map((rowId, i) => (
              <div key={rowId} className="flex items-center gap-2">
                <Input name={`variantOptions${suffix}`} placeholder={`Option ${i + 1}`} />
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
    </div>
  );
}

export function NewCustomCategoryForm() {
  const [state, formAction, pending] = useActionState(createCustomCategoryAction, initialState);
  const [tag1Type, setTag1Type] = useState<TagType>("none");
  const [showSecondTag, setShowSecondTag] = useState(false);
  const [tag2Type, setTag2Type] = useState<TagType>("freeText");

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <label className="flex flex-col gap-1.5">
        <Label>Category name</Label>
        <Input name="label" placeholder="e.g. Pins" required />
      </label>

      <TagFields
        suffix=""
        title="Does each item need an extra tag?"
        helpText="Like Flavor on e-juice or Gauge on Wire — optional, and shown as whatever you name it."
        allowNone
        tagType={tag1Type}
        onTagTypeChange={setTag1Type}
      />

      {tag1Type !== "none" &&
        (showSecondTag ? (
          <div>
            <TagFields
              suffix="2"
              title="Second tag (optional)"
              helpText="A separate field from the first — e.g. Type alongside Size."
              allowNone={false}
              tagType={tag2Type}
              onTagTypeChange={setTag2Type}
            />
            <button
              type="button"
              onClick={() => setShowSecondTag(false)}
              className="mt-2 text-xs text-muted underline underline-offset-2 hover:text-error"
            >
              Remove second tag
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowSecondTag(true)}
            className="self-start text-xs text-primary underline underline-offset-2"
          >
            + Add a second tag
          </button>
        ))}

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create category"}
      </Button>
    </form>
  );
}
