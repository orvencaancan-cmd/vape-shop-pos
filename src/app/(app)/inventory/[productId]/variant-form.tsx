"use client";

import { useActionState } from "react";
import {
  createVariantAction,
  updateVariantAction,
  deleteVariantAction,
  type ActionState,
} from "../actions";

const initialState: ActionState = {};

type VariantValues = {
  flavor?: string | null;
  nicotineMg?: number | null;
  size?: string | null;
  forDevice?: string | null;
  sku?: string | null;
  cost?: number;
  price?: number;
  lowStockThreshold?: number;
};

export function VariantForm({
  productId,
  productCategory,
  variantId,
  values,
}: {
  productId: string;
  productCategory: "ejuice" | "accessory";
  variantId?: string;
  values?: VariantValues;
}) {
  const boundAction = variantId
    ? updateVariantAction.bind(null, variantId, productId)
    : createVariantAction.bind(null, productId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const deleteAction = variantId ? deleteVariantAction.bind(null, variantId, productId) : undefined;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-3">
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
          <Field
            label="For device"
            name="forDevice"
            defaultValue={values?.forDevice ?? ""}
            list="device-suggestions"
          />
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
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : variantId ? "Save" : "Add variant"}
          </button>
        </div>
      </form>
      {productCategory === "accessory" && (
        <datalist id="device-suggestions">
          <option value="Oneo" />
          <option value="Xlim" />
          <option value="Nexlim" />
        </datalist>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {deleteAction && (
        <form action={deleteAction}>
          <button type="submit" className="text-xs text-red-600 underline">
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
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-slate-600">{label}</span>
      <input
        name={name}
        type={type}
        step={step}
        list={list}
        defaultValue={defaultValue}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
  );
}
