import Image from 'next/image';

export function SkilldBrand({ label = 'Agent portal' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/skilld-logo.png"
        alt="Skilld"
        width={1983}
        height={793}
        className="h-auto w-24 shrink-0"
        priority
      />
      <span className="border-l pl-3 text-sm text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
