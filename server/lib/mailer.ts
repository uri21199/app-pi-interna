import sgMail from '@sendgrid/mail';

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Falta ${name} en el entorno de la función.`);
  return value;
}

const fromEmail = required('SENDGRID_FROM_EMAIL', process.env.SENDGRID_FROM_EMAIL);

sgMail.setApiKey(required('SENDGRID_API_KEY', process.env.SENDGRID_API_KEY));

export async function enviarMail(to: string, subject: string, text: string, html: string) {
  await sgMail.send({ to, from: fromEmail, subject, text, html });
}
