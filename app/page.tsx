import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">GitHub Wrapped</h1>
        <p className="text-lg text-neutral-400">Descubre cómo programaste este año.</p>
      </div>

      <form
        action={async () => {
          "use server";
          await signIn("github");
        }}
      >
        <button
          type="submit"
          className="rounded-full bg-wrapped-accent px-6 py-3 font-medium text-black transition hover:opacity-90"
        >
          Connect GitHub
        </button>
      </form>

      <p className="max-w-md text-sm text-neutral-500">
        Solo analizamos tus repositorios públicos. El acceso a repositorios
        privados es opcional y se activa por separado más adelante.
      </p>
    </main>
  );
}
