import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { EncryptionBadge } from "../../src/crypto/EncryptionBadge.js";

describe("EncryptionBadge", () => {
  it("renders green shield-check for 'verified'", () => {
    const { container } = render(<EncryptionBadge status="verified" />);
    expect(container.querySelector(".text-green-500")).toBeTruthy();
  });

  it("renders yellow shield for 'encrypted-unverified'", () => {
    const { container } = render(<EncryptionBadge status="encrypted-unverified" />);
    expect(container.querySelector(".text-yellow-500")).toBeTruthy();
  });

  it("renders gray shield-off for 'unencrypted'", () => {
    const { container } = render(<EncryptionBadge status="unencrypted" />);
    expect(container.querySelector(".text-gray-500")).toBeTruthy();
  });

  it("renders nothing for 'unknown'", () => {
    const { container } = render(<EncryptionBadge status="unknown" />);
    expect(container.firstChild).toBeNull();
  });

  it("shows label text in 'md' size", () => {
    const { getByText } = render(<EncryptionBadge status="verified" size="md" />);
    expect(getByText("已验证")).toBeTruthy();
  });

  it("hides label text in 'sm' size", () => {
    const { queryByText } = render(<EncryptionBadge status="verified" size="sm" />);
    expect(queryByText("已验证")).toBeNull();
  });

  it("uses sm size by default", () => {
    const { queryByText } = render(<EncryptionBadge status="verified" />);
    expect(queryByText("已验证")).toBeNull();
  });

  it("shows '部分验证' label in md size for unverified", () => {
    const { getByText } = render(
      <EncryptionBadge status="encrypted-unverified" size="md" />,
    );
    expect(getByText("部分验证")).toBeTruthy();
  });

  it("shows '未加密' label in md size for unencrypted", () => {
    const { getByText } = render(<EncryptionBadge status="unencrypted" size="md" />);
    expect(getByText("未加密")).toBeTruthy();
  });
});
