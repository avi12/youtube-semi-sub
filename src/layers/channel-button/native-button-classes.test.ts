import { buildNativeButtonClasses } from "./native-button-classes";
import { describe, expect, it } from "vitest";

describe("buildNativeButtonClasses", () => {
  it("restyles m.youtube.com's filled Subscribe button as tonal", () => {
    // Copied from m.youtube.com's watch page Subscribe button
    const classes = buildNativeButtonClasses(
      "ytSpecButtonShapeNextHost ytSpecButtonShapeNextFilled ytSpecButtonShapeNextMono ytSpecButtonShapeNextSizeS ytSpecButtonShapeNextEnableBackdropFilterExperiment ytSpecButtonShapeNextMainstageIconSize ytSpecButtonShapeNextMainstagePadding"
    );
    expect(classes).toEqual({
      host: "ytSpecButtonViewModelHost",
      button: "ytSpecButtonShapeNextHost ytSpecButtonShapeNextTonal ytSpecButtonShapeNextMono ytSpecButtonShapeNextSizeS ytSpecButtonShapeNextEnableBackdropFilterExperiment ytSpecButtonShapeNextMainstageIconSize ytSpecButtonShapeNextMainstagePadding",
      buttonWithIcon: "ytSpecButtonShapeNextHost ytSpecButtonShapeNextTonal ytSpecButtonShapeNextMono ytSpecButtonShapeNextSizeS ytSpecButtonShapeNextEnableBackdropFilterExperiment ytSpecButtonShapeNextMainstageIconSize ytSpecButtonShapeNextMainstagePadding ytSpecButtonShapeNextIconLeading",
      icon: "ytSpecButtonShapeNextIcon",
      text: "ytSpecButtonShapeNextButtonTextContent"
    });
  });

  it("drops the icon layout of a button that had one", () => {
    const { button } = buildNativeButtonClasses("ytSpecButtonShapeNextHost ytSpecButtonShapeNextTonal ytSpecButtonShapeNextIconLeadingTrailing");
    expect(button).toBe("ytSpecButtonShapeNextHost ytSpecButtonShapeNextTonal");
  });

  it("speaks the older BEM class names when YouTube serves them", () => {
    const classes = buildNativeButtonClasses(
      "yt-spec-button-shape-next yt-spec-button-shape-next--filled yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m yt-spec-button-shape-next--icon-leading"
    );
    expect(classes).toEqual({
      host: "yt-spec-button-view-model",
      button: "yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m",
      buttonWithIcon: "yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m yt-spec-button-shape-next--icon-leading",
      icon: "yt-spec-button-shape-next__icon",
      text: "yt-spec-button-shape-next__button-text-content"
    });
  });

  it("still yields a tonal button without a native one to copy", () => {
    expect(buildNativeButtonClasses("").button).toBe("ytSpecButtonShapeNextTonal");
  });
});
