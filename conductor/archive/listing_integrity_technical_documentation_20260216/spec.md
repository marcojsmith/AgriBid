# Specification: Wizard Hardening & Data Integrity

## 1. Requirements

### 1.1 Wizard Hardening (Validation)
- **Pricing**: Prevent negative values for starting and reserve prices.
- **Reserve Logic**: Enforce `reservePrice >= startingPrice`.
- **Year Validation**: Ensure the manufacturing year is a valid number and doesn't clobber during input.
- **Step Enforcement**: Disable the "Next" button in the wizard if the current step has validation errors.
- **Accessibility**: Ensure all hidden file inputs have accessible names.

## 2. Acceptance Criteria
- [ ] Starting price and reserve price inputs reject negative numbers.
- [ ] A validation error appears if the reserve price is set lower than the starting price.
- [ ] The "Next" button in the wizard is disabled until the current step's fields are valid.
- [ ] Year input allows typing without resetting to 0 immediately on invalid input.
- [ ] Hidden file inputs for images are accessible to screen readers.
