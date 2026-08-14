import AdminForth, { AdminForthPlugin, Filters, suggestIfTypo } from "adminforth";
import type { IAdminForth, IHttpServer, AdminForthComponentDeclaration, AdminForthResourceColumn, AdminForthDataTypes, AdminForthResource } from "adminforth";
import type { PluginOptions } from './types.js';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import validator from 'validator';
import { z } from "zod";
import { createHash } from 'crypto';

const resetPasswordBodySchema = z.object({
  email: z.string(),
  url: z.string(),
}).strict();

const resetPasswordConfirmBodySchema = z.object({
  token: z.string(),
  password: z.string(),
}).strict();

export default class EmailPasswordReset extends AdminForthPlugin {
  options: PluginOptions;
  emailField: AdminForthResourceColumn;
  authResourceId: string;
  adminforth: IAdminForth;

  constructor(options: PluginOptions) {
    super(options, import.meta.url);
    this.options = options;
    this.shouldHaveSingleInstancePerWholeApp = () => true;
  }

  async modifyResourceConfig(adminforth: IAdminForth, resourceConfig: AdminForthResource) {
    super.modifyResourceConfig(adminforth, resourceConfig);

    // find field with name resourceConfig.emailField in adminforth.auth.usersResourceId and show error if it doesn't exist
    const authResource = adminforth.config.resources.find(r => r.resourceId === adminforth.config.auth.usersResourceId);
    if (!authResource) {
      throw new Error(`Resource with id config.auth.usersResourceId=${adminforth.config.auth.usersResourceId} not found`);
    }
    this.authResourceId = authResource.resourceId;

    const emailField = authResource.columns.find(f => f.name === this.options.emailField);
    if (!emailField) {
      const similar = suggestIfTypo(authResource.columns.map(f => f.name), this.options.emailField);

      throw new Error(`Field with name ${this.options.emailField} not found in resource ${authResource.resourceId}.
        ${similar ? `Did you mean ${similar}?` : ''}
      `);
    }
    this.emailField = emailField;

    if (!this.options.passwordField) {
      throw new Error(`passwordField is required to get password constraints and should be a name of virtual field in auth resource`);
    }

    const passwordField = authResource.columns.find(f => f.name === this.options.passwordField);
    if (!passwordField) {
      const similar = suggestIfTypo(authResource.columns.map(f => f.name), this.options.passwordField);

      throw new Error(`Field with name ${this.options.passwordField} not found in resource ${authResource.resourceId}.
        ${similar ? `Did you mean ${similar}?` : ''}
      `);
    }

    if (!this.options.adapter) {
      throw new Error('Adapter is required. Please provide a valid adapter in the plugin options.');
    }


    (adminforth.config.customization.loginPageInjections.underLoginButton as Array<any>).push({ 
      file: this.componentPath('ResetPasswordUnderLogin.vue'), meta: { afOrder: this.options.loginPageComponentOrder || 0} }
    );
    adminforth.config.customization.customPages.push({
      path:'/reset-password',
      component: { 
        file: this.componentPath('ResetPassword.vue'), 
        meta: { 
          sidebarAndHeader: "none", 
          pluginInstanceId: this.pluginInstanceId,
          passwordField: {
            minLength: passwordField.minLength,
            maxLength: passwordField.maxLength,
            validation: passwordField.validation
          },
          pageInjection: this.options.pageInjection
        }
      }
    })
    if (this.options.pageInjection?.panelHeader) {
      adminforth.codeInjector.registerCustomComponent(this.options.pageInjection.panelHeader);
    }
    if ((this.options.pageInjection as any)?.underLoginButton) {
      adminforth.codeInjector.registerCustomComponent((this.options.pageInjection as any).underLoginButton);
    }

    // simply modify resourceConfig or adminforth.config. You can get access to plugin options via this.options;
  }
  
  validateConfigAfterDiscover(adminforth: IAdminForth, resourceConfig: AdminForthResource) {
    // optional method where you can safely check field types after database discovery was performed

    this.options.adapter.validate();

    const rawOrigins = this.options.expectedOrigin;
    const originList = Array.isArray(rawOrigins) ? rawOrigins : [rawOrigins];
    if (!rawOrigins || originList.length === 0 || originList.some(o => !o)) {
      throw new Error(
        'EmailPasswordReset: expectedOrigin is required. Set it to the admin panel origin(s) ' +
        '(e.g. "https://admin.example.com") so reset links can only point to a trusted host.'
      );
    }
    for (const origin of originList) {
      try {
        new URL(origin);
      } catch {
        throw new Error(`EmailPasswordReset: expectedOrigin "${origin}" is not a valid absolute URL/origin.`);
      }
    }
  }

  getAllowedOrigins(): string[] {
    const rawOrigins = this.options.expectedOrigin;
    const originList = Array.isArray(rawOrigins) ? rawOrigins : [rawOrigins];
    return originList.map(o => new URL(o).origin);
  }

  /**
   * Short non-reversible digest of the user's current password hash. It is put into the reset token
   * and re-checked on confirm, so as soon as the password is changed (by this link or any other way)
   * every previously issued link for this user stops working, without relying on any storage.
   */
  passwordHashDigest(passwordHash: string | null | undefined): string {
    return createHash('sha256').update(passwordHash || '').digest('hex').slice(0, 16);
  }

  instanceUniqueRepresentation(pluginOptions: any) : string {
    // optional method to return unique string representation of plugin instance. 
    // Needed if plugin can have multiple instances on one resource 
    return `single`;
  }

  setupEndpoints(server: IHttpServer) {
    server.endpoint({
      method: 'POST',
      path: `/plugin/${this.pluginInstanceId}/reset-password`,
      noAuth: true,
      request_schema: resetPasswordBodySchema,
      handler: async ({ body, response }) => {
        const data = body as z.infer<typeof resetPasswordBodySchema>;
        const { email, url } = data;

        // validate email
        if (!email || typeof email !== 'string' || !validator.isEmail(email)) {
          return { error: 'Invalid email address', ok: false };
        }

        let resetLink: string;
        try {
          const parsedUrl = new URL(url);
          if (!this.getAllowedOrigins().includes(parsedUrl.origin)) {
            return { error: 'Invalid reset url', ok: false };
          }
          parsedUrl.hash = '';
          resetLink = parsedUrl.toString();
        } catch {
          return { error: 'Invalid reset url', ok: false };
        }

        const af = await this.adminforth.resource(this.authResourceId).get(Filters.EQ(this.emailField.name, email));
        if (af) {
          const brandName = this.adminforth.config.customization.brandName;

          const resetToken = this.adminforth.auth.issueJWT(
            {
              email,
              issuer: brandName,
              ph: this.passwordHashDigest(af[this.adminforth.config.auth.passwordHashField]),
            },
            'tempResetPassword',
            '2h'
          );

          const resetUrlWithToken = (() => {
            const u = new URL(resetLink);
            u.searchParams.set('token', resetToken);
            return u.toString();
          })();

          const emailText = `
                    Dear user,
                    To reset your ${brandName} password, click the link below:\n\n

                    ${resetUrlWithToken}\n\n

                    If you didn't request this, please ignore this email.\n\n
                    Link is valid for 2 hours.\n\n

                    Thanks,
                    The ${brandName} Team
                                      
                  `;
          
          const emailHtml = `
                  <html>
                    <head></head>
                    <body>
                      <p>Dear user,</p>
                      <p>To reset your ${brandName} password, click the link below:</p>
                      <p><a href="${resetUrlWithToken}">Reset password</a></p>
                      <p>If you didn't request this, please ignore this email.</p>
                      <p>Link is valid for 2 hours.</p>
                      <p>Thanks,</p>
                      <p>The ${brandName} Team</p>
                    </body>
                  </html>


                  `;
          const emailSubject = `Password reset request at ${brandName}`;
          // send email with AWS SES this.options.providerOptions.AWS_SES
          this.options.adapter.sendEmail(this.options.sendFrom, email, emailText, emailHtml, emailSubject);
        }

        return { ok: true };
      }
    });

    server.endpoint({
      method: 'POST',
      path: `/plugin/${this.pluginInstanceId}/reset-password-confirm`,
      noAuth: true,
      request_schema: resetPasswordConfirmBodySchema,
      handler: async ({ body, response }) => {
        const data = body as z.infer<typeof resetPasswordConfirmBodySchema>;
        const { token, password } = data;
        const isUsed = await this.options.userResetTokensKeyValueAdapter.get(token);
        if (isUsed) {
          return { error: 'Token has already been used', ok: false };
        }
        await this.options.userResetTokensKeyValueAdapter.set(token, 'used', 60 * 60 * 2);
        const decoded = await this.adminforth.auth.verify(token, 'tempResetPassword', false);
        if (!decoded) {
          return { error: 'Invalid token', ok:false };
        }

        const af = await this.adminforth.resource(this.authResourceId).get(Filters.EQ(this.emailField.name, decoded.email));
        if (af) {
          // find password hash field name
          const passwordHashFieldName = this.adminforth.config.auth.passwordHashField;

          // token is bound to the password which was actual when the link was issued, so the link
          // becomes unusable once the password was changed (e.g. by this very link before)
          if (decoded.ph !== this.passwordHashDigest(af[passwordHashFieldName])) {
            return { error: 'Token has already been used', ok: false };
          }

          const newPasswordHash = await AdminForth.Utils.generatePasswordHash(password);
          const primaryKeyField = this.adminforth.config.resources.find(r => r.resourceId === this.authResourceId).columns.find(c => c.primaryKey);
          // update password
          await this.adminforth.resource(this.authResourceId).update(af[primaryKeyField.name], { [passwordHashFieldName]: newPasswordHash });
        }

        return { ok: true };
      }
    });

  }

}