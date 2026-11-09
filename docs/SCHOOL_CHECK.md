# School account check

This small Apps Script finds out what your school's Google accounts allow, so we know how to move Maker Lab into Apps Script. It takes about 10 minutes.

It saves no names or email addresses. It creates one Sheet, called **Maker Lab school check (safe to delete)**, which only holds times and run numbers.

## 1. Set it up with your teacher account

1. Go to [script.google.com](https://script.google.com/home/projects/create) in Chrome, signed in to your school account. A new project opens.
2. Delete what's in **Code.gs**, then paste in all of `app/static/apps-script/school-check.gs`.
3. Press **Deploy**, then **New deployment**. Click the gear and choose **Web app**.
4. Set **Execute as: Me**.
5. Set **Who has access: Anyone within [your school]**.
6. Press **Deploy** and allow access when Google asks. Copy the **Web app URL**.

## 2. Run it as yourself

Open the URL. Then press each blue button:

* **Send to micro:bit over USB:** plug in a micro:bit first if you have one.
* **Downloads a .hex file:** say whether the file appeared.
* **CreateAI opens:** say whether it opened.
* **Handles a whole class at once:** this makes 30 saves at the same time.

## 3. Run it as a student

This part matters most, since students under 18 can have different restrictions. Use a **test student account** set up like a real student's. Please don't use a real student's account.

Open the same URL in that account on a **Chromebook** like the ones students use. If the page won't open, write down the exact message on the screen.

## 4. Send back the results

Copy the text from the **Your results** box for each account, and paste both back into this chat. Include any error messages you saw.

## Questions for your admin or data privacy contact

1. Is Apps Script covered by our Google Workspace for Education agreement, and allowed for students under 18?
2. Can students use a web app built in Apps Script by a teacher, limited to our domain?
3. May students use the micro:bit simulator (`python-simulator.usermbit.org`) and CreateAI (`createai.microbit.org`)? Neither needs student names.
4. Who should own the student data: a teacher's account, or a shared drive the school controls?
5. Is it okay to show first names and progress on the Classroom Screen?

## Afterward

Delete the **Maker Lab school check** Sheet from Drive, and delete the script project. You can also turn off the deployment under **Deploy**, then **Manage deployments**.
