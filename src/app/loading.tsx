import { ScanLoader } from "@/components/scanner/figure";

export default function Loading() {
  return (
    <div className="flex min-h-svh items-center bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <ScanLoader />
      </div>
    </div>
  );
}
