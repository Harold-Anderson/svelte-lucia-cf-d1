import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { Argon2id } from 'oslo/password';
import { eq } from 'drizzle-orm';
import { userTable } from '$lib/schema';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) return redirect(302, '/');
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals, cookies }) => {
    const formData = await request.formData();
    const username = formData.get('username');
    const password = formData.get('password');
    if (
      typeof username !== 'string' ||
      username.length < 3 ||
      username.length > 31 ||
      !/^[a-z0-9_-]+$/.test(username)
    ) {
      return fail(400, {
        message: 'Invalid username'
      });
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 255) {
      return fail(400, {
        message: 'Invalid password'
      });
    }

    const existingUser = await locals.DB.query.userTable.findFirst({
      where: eq(userTable.username, username)
    });

    if (!existingUser) {
      return fail(400, {
        message: 'Incorrect username or password'
      });
    }

    const validPassword = await new Argon2id().verify(existingUser.password, password);
    if (!validPassword) {
      return fail(400, {
        message: 'Incorrect username or password'
      });
    }
    const lucia = locals.lucia;
    const session = await lucia.createSession(existingUser.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookies.set(sessionCookie.name, sessionCookie.value, {
      path: '.',
      ...sessionCookie.attributes
    });

    return redirect(302, '/');
  }
};
