import { SignUpForm } from "./signup-form";

export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-900">
          Start your free trial
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          14 days free, no charge until it ends.
        </p>
      </div>
      <SignUpForm />
    </main>
  );
}
