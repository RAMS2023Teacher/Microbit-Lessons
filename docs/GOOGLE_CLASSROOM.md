# Sending grades to Google Classroom

This uses **Google Apps Script** in the teacher's own Google account. There's no Google Cloud project to manage, no secret keys on this site, and no hosting needed for this part.

**How it works:** on a class page, choose **Google Classroom**, copy the grades, and paste them into your Apps Script sender. The sender matches students to your roster, makes a Classroom assignment for each lesson, and saves **draft** grades.

The setup steps are on that page. The script is `app/static/apps-script/maker-lab-classroom.gs`.

## Good to know

* Google only lets a script grade assignments that same script created, so it makes its own. It can't fill in assignments made by hand.
* Students see the assignments in Classroom, but not the draft grades until you return them.
* Students are matched by name, and only when exactly one person fits. Anyone else is left for you to choose. Matches are remembered for each class.
* Sending again updates the drafts and doesn't make duplicate assignments.
* Copied grades contain student names, so treat your clipboard and the paste box with care.
* If you replace the script's project, it can no longer grade assignments the old project made.
