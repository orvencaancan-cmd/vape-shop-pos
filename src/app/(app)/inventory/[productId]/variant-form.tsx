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

export function VariantForm({
  productId,
  productCategory,
  productSubcategory,
  variantId,
  values,
}: {
  productId: string;
  productCategory: "ejuice" | "accessory";
  productSubcategory?: string | null;
  variantId?: string;
  values?: VariantValues;
}) {
  const boundAction = variantId
    ? updateVariantAction.bind(null, variantId, productId)
    : createVariantAction.bind(null, productId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const deleteAction = variantId ? deleteVariantAction.bind(null, variantId, productId) : undefined;
  const isCartridge = productSubcategory?.trim().toLowerCase() === "cartridge";

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
        ) : (
          <>
            <Field
              label="For device"
              name="forDevice"
              defaultValue={values?.forDevice ?? ""}
              list="device-suggestions"
            />
            {isCartridge && (
              <Field
                label="Ohms"
                name="ohms"
                type="number"
                step="0.1"
                defaultValue={values?.ohms ?? ""}
                list="ohms-suggestions"
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
      {productCategory === "accessory" && (
        <datalist id="device-suggestions">
          <option value="Oneo" />
          <option value="Xlim" />
          <option value="Nexlim" />
        </datalist>
      )}
      {isCartridge && (
        <datalist id="ohms-suggestions">
          <option value="0.4" />
          <option value="0.6" />
          <option value="0.8" />
        </datalist>
      )}
      {state.error && <p className="text-sm text-error">{state.error}</p>}
      {deleteAction && (
        <form action={deleteAction}>
          <button type="submit" className="text-xs text-error underline">
            Delete variant
          </button>
        </form>
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
