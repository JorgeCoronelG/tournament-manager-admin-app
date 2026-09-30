export interface ActivateAccountModel {
  /** From the link; typed by hand when the link has no parameters */
  email: string;
  code: string;
  password: string;
  passwordConfirmation: string;
}
