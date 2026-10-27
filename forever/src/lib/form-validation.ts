import type { SyntheticEvent } from "react";

function getField(event: SyntheticEvent<HTMLFormElement>) {
  const field = event.target;
  return field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement ? field : null;
}

export function clearFieldValidity(event: SyntheticEvent<HTMLFormElement>) {
  getField(event)?.setCustomValidity("");
}

export function localizeFieldValidity(event: SyntheticEvent<HTMLFormElement>) {
  const field = getField(event);
  if (!field) return;
  field.setCustomValidity("");
  const { validity } = field;
  if (validity.valueMissing) {
    field.setCustomValidity(field instanceof HTMLSelectElement ? "Wybierz opcję z listy." : "Uzupełnij to pole.");
  } else if (validity.typeMismatch) {
    field.setCustomValidity("Podaj poprawny adres e-mail.");
  } else if (validity.tooShort && field instanceof HTMLInputElement) {
    field.setCustomValidity(`Wpisz co najmniej ${field.minLength} znaków.`);
  } else if (validity.tooLong && field instanceof HTMLInputElement) {
    field.setCustomValidity(`Wpisz nie więcej niż ${field.maxLength} znaków.`);
  } else if (!validity.valid) {
    field.setCustomValidity("Sprawdź poprawność wpisanej wartości.");
  }
}
