"use client";

import { useActionState } from "react";
import {
  createVariantAction,
  updateVariantAction,
  deleteVariantAction,
  type ActionState,
} from "../actions";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/action-button";

const initialState: ActionState = {};

type VariantValues = {
  flavor?: string | null;
  nicotineMg?: number | null;
  size?: string | null;
  forDevice?: string | null;
  ohms?: number | null;
  sku?: string | null;
  cost?: number;
  price?: number;
  lowStockThreshold?: number;
};

type VariantDimension =
  | { label: string; field: "ohms" | "size" | "flavor"; inputType: "checklist"; options: { value: string; label: string }[] }
  | { label: string; field: "ohms" | "size" | "flavor"; inputType: "freeText" };

export function VariantForm({
  productId,
  productCategory,
  dimension,
  dimension2,
  isCustomCategory,
  variantId,
  values,
}: {
  productId: string;
  productCategory: string;
  dimension?: VariantDimension;
  dimension2?: VariantDimension;
  isCustomCategory?: boolean;
  variantId?: string;
  values?: VariantValues;
}) {
  const boundAction = variantId
    ? updateVariantAction.bind(null, variantId, productId)
    : createVariantAction.bind(null, productId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const deleteAction = variantId ? deleteVariantAction.bind(null, variantId, productId) : undefined;
  const dimensionSuggestions =
    dimension?.inputType === "checklist" ? dimension.options.map((o) => o.value) : [];
  const dimension2Suggestions =
    dimension2?.inputType === "checklist" ? dimension2.options.map((o) => o.value) : [];

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-canvas-soft p-3">
      <form action={formAction} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {productCategory === "ejuice" ? (
          <>
            <Field label="Flavor" name="flavor" defaultValue={values?.flavor ?? ""} />
            <Field
              label="Nicotine mg"
              name="nicotineMg"
              type="number"
              step="0.1"
              defaultValue={values?.nicotineMg ?? ""}
            />
            <Field label="Size" name="size" defaultValue={values?.size ?? ""} />
          </>
        ) : isCustomCategory ? (
          <>
            {dimension?.field === "ohms" && (
              <Field
                label={dimension.label}
                name="ohms"
                type="number"
                step="0.1"
                defaultValue={values?.ohms ?? ""}
                list={dimensionSuggestions.length > 0 ? "dimension-suggestions" : undefined}
              />
            )}
            {dimension?.field === "size" && (
              <Field
                label={dimension.label}
                name="size"
                defaultValue={values?.size ?? ""}
                list={dimensionSuggestions.length > 0 ? "dimension-suggestions" : undefined}
              />
            )}
            {dimension?.field === "flavor" && (
              <Field
                label={dimension.label}
                name="flavor"
                defaultValue={values?.flavor ?? ""}
                list={dimensionSuggestions.length > 0 ? "dimension-suggestions" : undefined}
              />
            )}
            {dimension2?.field === "ohms" && (
              <Field
                label={dimension2.label}
                name="ohms"
                type="number"
                step="0.1"
                defaultValue={values?.ohms ?? ""}
                list={dimension2Suggestions.length > 0 ? "dimension2-suggestions" : undefined}
              />
            )}
            {dimension2?.field === "size" && (
              <Field
                label={dimension2.label}
                name="size"
                defaultValue={values?.size ?? ""}
                list={dimension2Suggestions.length > 0 ? "dimension2-suggestions" : undefined}
              />
            )}
            {dimension2?.field === "flavor" && (
              <Field
                label={dimension2.label}
                name="flavor"
                defaultValue={values?.flavor ?? ""}
                list={dimension2Suggestions.length > 0 ? "dimension2-suggestions" : undefined}
              />
            )}
          </>
        ) : (
          <>
            <Field
              label="For device"
              name="forDevice"
              defaultValue={values?.forDevice ?? ""}
              list="device-suggestions"
            />
            {dimension?.field === "ohms" && (
              <Field
                label={dimension.label}
                name="ohms"
                type="number"
                step="0.1"
                defaultValue={values?.ohms ?? ""}
                list={dimensionSuggestions.length > 0 ? "dimension-suggestions" : undefined}
              />
            )}
            {dimension?.field === "size" && (
              <Field
                label={dimension.label}
                name="size"
                defaultValue={values?.size ?? ""}
                list={dimensionSuggestions.length > 0 ? "dimension-suggestions" : undefined}
              />
            )}
            {dimension?.field === "flavor" && (
              <Field
                label={dimension.label}
                name="flavor"
                defaultValue={values?.flavor ?? ""}
                list={dimensionSuggestions.length > 0 ? "dimension-suggestions" : undefined}
              />
            )}
          </>
        )}
        <Field label="SKU" name="sku" defaultValue={values?.sku ?? ""} />
        <Field
          label="Cost"
          name="cost"
          type="number"
          step="0.01"
          defaultValue={values?.cost ?? ""}
        />
        <Field
          label="Price"
          name="price"
          type="number"
          step="0.01"
          defaultValue={values?.price ?? ""}
        />
        <Field
          label="Low stock at"
          name="lowStockThreshold"
          type="number"
          defaultValue={values?.lowStockThreshold ?? 5}
        />
        <div className="flex items-end">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving…" : variantId ? "Save" : "Add variant"}
          </Button>
        </div>
      </form>
      {productCategory !== "ejuice" && !isCustomCategory && (
        <datalist id="device-suggestions">
          <option value="Oneo" />
          <option value="Xlim" />
          <option value="Nexlim" />
        </datalist>
      )}
      {dimensionSuggestions.length > 0 && (
        <datalist id="dimension-suggestions">
          {dimensionSuggestions.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      )}
      {dimension2Suggestions.length > 0 && (
        <datalist id="dimension2-suggestions">
          {dimension2Suggestions.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      )}
      {state.error && <p className="text-sm text-error">{state.error}</p>}
      {deleteAction && (
        <ActionButton action={deleteAction} className="text-xs text-error underline">
          Delete variant
        </ActionButton>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  step,
  defaultValue,
  list,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  defaultValue?: string | number;
  list?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <Label className="text-[11px]">{label}</Label>
      <Input name={name} type={type} step={step} list={list} defaultValue={defaultValue} className="text-sm" />
    </label>
  );
}
