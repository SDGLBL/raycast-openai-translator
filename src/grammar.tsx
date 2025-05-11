import getBase from "./base";
import { LaunchProps } from "@raycast/api";

export default function Command(props: LaunchProps) {
  return getBase(props, "grammar", false, true, false);
}
