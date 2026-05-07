import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="top-right"
      duration={2500}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-center gap-3 w-[360px] p-4 rounded-2xl bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)] border border-neutral-100 backdrop-blur",
          title: "font-bold text-[15px] text-neutral-900 leading-tight",
          description: "text-[13px] text-neutral-500 leading-snug mt-0.5",
          icon: "shrink-0 h-10 w-10 rounded-full grid place-items-center text-xl",
          success:
            "[&_[data-icon]]:bg-gradient-to-br [&_[data-icon]]:from-primary [&_[data-icon]]:to-orange-500 [&_[data-icon]]:text-white [&_[data-icon]]:shadow-lg",
          error:
            "[&_[data-icon]]:bg-red-500 [&_[data-icon]]:text-white",
          info: "[&_[data-icon]]:bg-blue-500 [&_[data-icon]]:text-white",
          closeButton:
            "!bg-neutral-100 !border-0 !text-neutral-600 hover:!bg-neutral-200",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
