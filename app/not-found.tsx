export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <h1 className="text-4xl font-bold tracking-tight">404</h1>
      <p className="mt-2 text-muted-foreground">Page not found</p>
      <a href="/dashboard" className="mt-4 text-sm text-primary underline">
        Go to Dashboard
      </a>
    </div>
  );
}
