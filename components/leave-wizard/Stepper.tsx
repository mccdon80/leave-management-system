"use client";

type Step = {
  key: string;
  title: string;
  subtitle?: string;
};

export default function Stepper({
  steps,
  currentIndex,
}: {
  steps: Step[];
  currentIndex: number;
}) {
  return (
    <div className="border rounded-lg bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm text-neutral-500">Leave booking</div>
          <div className="text-lg font-semibold">{steps[currentIndex]?.title}</div>
          {steps[currentIndex]?.subtitle ? (
            <div className="text-sm text-neutral-500 mt-1">
              {steps[currentIndex].subtitle}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {steps.map((s, idx) => {
            const state =
              idx < currentIndex ? "done" : idx === currentIndex ? "active" : "todo";

            return (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className={[
                    "h-8 w-8 rounded-full grid place-items-center text-sm font-medium border",
                    state === "done"
                      ? "bg-neutral-900 text-white border-neutral-900"
                      : state === "active"
                      ? "bg-white text-neutral-900 border-neutral-900"
                      : "bg-white text-neutral-400 border-neutral-200",
                  ].join(" ")}
                >
                  {idx + 1}
                </div>

                {idx !== steps.length - 1 && (
                  <div className="h-0.5 w-6 bg-neutral-200" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
