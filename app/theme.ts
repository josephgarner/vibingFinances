import { colorsTuple, createTheme } from "@mantine/core";

const theme = createTheme({
  primaryColor: "primaryGrey",
  autoContrast: true,
  defaultRadius: "md",
  colors: {
    primaryGrey: colorsTuple("#D7CDCC"),
    red: colorsTuple("#d68b83"),
    debit: colorsTuple("#FF8E72"),
    credit: colorsTuple("#CBE896"),
    category: colorsTuple("#93B5C6"),
    subCategory: colorsTuple("#93B5C6"),
  },
  fontFamily:
    "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  headings: {
    fontFamily:
      "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
});

export default theme;
