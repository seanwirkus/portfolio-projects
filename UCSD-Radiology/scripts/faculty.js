// Assign team numbers for grouping
      const adminLeadership = 1;
      const viceChairs = 2;
      const divisionChiefs = 3;

      //Faculty Database
      // This file contains the faculty information for the UCSD Radiology website.
      // It is used to populate the faculty section of the website.
      // The data is stored in a JSON format and includes information such as name, focus, role, modality, degree, email, title, image URL, profile URL, and team.
      window.facultyJson = [
    {
        "name": "Ahrens, Eric",
        "focus1": "Research",
        "focus2": null,
        "role": null,
        "modality": null,
        "degree": "PhD",
        "email": "eahrens@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/eric.ahrens",
        "imageSrc": null
    },
    {
        "name": "Andre, Michael",
        "focus1": "Research",
        "focus2": null,
        "role": null,
        "modality": null,
        "degree": "PhD",
        "email": "mandre@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/michael.andre",
        "imageSrc": null
    },
    {
        "name": "Bae, Won",
        "focus1": "Research",
        "focus2": null,
        "role": null,
        "modality": null,
        "degree": "PhD",
        "email": "wbae@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/won.bae",
        "imageSrc": null
    },
    {
        "name": "Berman, Zachary",
        "focus1": "Clinical",
        "focus2": null,
        "role": null,
        "modality": "Interventional Radiology",
        "degree": "MD PhD",
        "email": "zberman@health.ucsd.edu",
        "team": null,
        "profileUrl": "https://providers.ucsd.edu/details/1033521190/radiology",
        "imageSrc": "images/faculty-images/Zachary_Berman.webp"
    },
    {
        "name": "Bolar, Divya",
        "focus1": "Clinical",
        "focus2": null,
        "role": null,
        "modality": "Musculoskeletal Imaging",
        "degree": "MD MPH",
        "email": "dbolar@health.ucsd.edu",
        "team": null,
        "profileUrl": "https://profiles.ucsd.edu/divya.bolar",
        "imageSrc": null
    },
    {
        "name": "Bykowski, Julie",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Division Chief",
        "modality": "Neuroimaging",
        "degree": "MD",
        "email": "jbykowski@health.ucsd.edu",
        "team": 3,
        "profileUrl": "http://profiles.ucsd.edu/julie.marekbykowski",
        "imageSrc": "images/faculty-images/Julie_Bykowski.webp"
    },
    {
        "name": "Brouha, Sharon",
        "focus1": "Clinical",
        "focus2": null,
        "role": null,
        "modality": "Cardiothoracic Imaging",
        "degree": "MD MPH",
        "email": "sbrouha@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/sharon.brouha",
        "imageSrc": null
    },
    {
        "name": "Chang, Eric",
        "focus1": "Research",
        "focus2": null,
        "role": "Associate Director, T32 Residency ",
        "modality": "Musculoskeletal Imaging",
        "degree": "MD",
        "email": "e8chang@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/eric.chang",
        "imageSrc": null
    },
    {
        "name": "Chang, Jennifer",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Director, MRI Fellowship Program",
        "modality": "Neuroimaging",
        "degree": "MD",
        "email": "jenchang@health.ucsd.edu",
        "team": 4,
        "profileUrl": "http://profiles.ucsd.edu/jennifer.chang",
        "imageSrc": "images/faculty-images/Jen_Chang.webp"
    },
    {
        "name": "Chapelin, Fanny",
        "focus1": "Research",
        "focus2": null,
        "role": "Associate Director, T32 Residency ",
        "modality": null,
        "degree": "PhD",
        "email": "fachapelin@health.ucsd.edu",
        "team": null,
        "profileUrl": "https://profiles.ucsd.edu/fanny.chapelin",
        "imageSrc": null
    },
    {
        "name": "Chen, James",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Director, Neuro Fellowship Program",
        "modality": "Neuroimaging",
        "degree": "MD",
        "email": "Jyc042@health.ucsd.edu",
        "team": 4,
        "profileUrl": "https://profiles.ucsd.edu/james.chen",
        "imageSrc": null
    },
    {
        "name": "Chen, Chi-Hua",
        "focus1": "Research",
        "focus2": null,
        "role": null,
        "modality": null,
        "degree": "PhD",
        "email": "chc101@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/chi-hua.chen",
        "imageSrc": null
    },
    {
        "name": "Cheng, Karen",
        "focus1": "Clinical",
        "focus2": null,
        "role": null,
        "modality": "Musculoskeletal Imaging",
        "degree": "MD",
        "email": "kcheng@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/karen.chen",
        "imageSrc": "images/faculty-images/Karen_Cheng.webp"
    },
    {
        "name": "Chung, Christine",
        "focus1": "Clinical",
        "focus2": "Research",
        "role": "Department Chair",
        "modality": "Musculoskeletal Imaging",
        "degree": "MD MBA",
        "email": "cbchung@health.ucsd.edu",
        "team": 1,
        "profileUrl": "http://profiles.ucsd.edu/christine.chung",
        "imageSrc": "images/faculty-images/Chung_Christine.webp"
    },
    {
        "name": "Dale, Anders",
        "focus1": "Research",
        "focus2": null,
        "role": null,
        "modality": null,
        "degree": "PhD",
        "email": "amdale@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/anders.dale",
        "imageSrc": null
    },
    {
        "name": "Dorros, Stephen",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Vice Chair of Business Development",
        "modality": "Musculoskeletal Imaging",
        "degree": "MD",
        "email": "sdorros@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/stephen.dorros",
        "imageSrc": null
    },
    {
        "name": "Du, Jiang",
        "focus1": "Research",
        "focus2": null,
        "role": null,
        "modality": null,
        "degree": "PhD",
        "email": "jiangdu@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/jiang.du",
        "imageSrc": null
    },
    {
        "name": "El Kaffas, Ahmed",
        "focus1": "Research",
        "focus2": null,
        "role": null,
        "modality": null,
        "degree": "PhD",
        "email": "aelkaffas@health.ucsd.edu",
        "team": null,
        "profileUrl": "https://profiles.ucsd.edu/admed.elkaffas",
        "imageSrc": null
    },
    {
        "name": "Elmi, Azadeh",
        "focus1": null,
        "focus2": null,
        "role": null,
        "modality": "Breast Imaging",
        "degree": "MD",
        "email": "aelmi@health.ucsd.edu",
        "team": null,
        "profileUrl": null,
        "imageSrc": "images/faculty-images/Azadeh_Elmi.webp"
    },
    {
        "name": "Farid, Nikdokht",
        "focus1": "Clinical",
        "focus2": null,
        "role": null,
        "modality": "Neuroimaging",
        "degree": "MD",
        "email": "nfarid@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/nikdokht.farid",
        "imageSrc": "images/faculty-images/Niky_Farid.webp"
    },
    {
        "name": "Fazeli, Soudabeh",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Director, Breast Imaging Fellowship Program",
        "modality": "Breast Imaging",
        "degree": "MD",
        "email": "sfazelidehkordy@health.ucsd.edu",
        "team": 4,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Fliszar, Evelyne",
        "focus1": "Clinical",
        "focus2": null,
        "role": null,
        "modality": "Musculoskeletal Imaging",
        "degree": "MD",
        "email": "efliszar@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/evelyne.fliszar",
        "imageSrc": "images/faculty-images/Evelyne_Fliszar.webp"
    },
    {
        "name": "Frank, Lawrence",
        "focus1": "Research",
        "focus2": null,
        "role": null,
        "modality": null,
        "degree": "PhD",
        "email": "lrfrank@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/lawrence.frank",
        "imageSrc": null
    },
    {
        "name": "Gamie, Sherief",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Division Chief",
        "modality": "Nuclear Medicine",
        "degree": "MD PhD",
        "email": "sgamie@health.ucsd.edu",
        "team": 3,
        "profileUrl": "http://profiles.ucsd.edu/sherief.gamie",
        "imageSrc": null
    },
    {
        "name": "Gentili, Amilcare",
        "focus1": "Clinical",
        "focus2": null,
        "role": null,
        "modality": "Musculoskeletal Imaging",
        "degree": "MD",
        "email": "agentili@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/amilcare.gentili",
        "imageSrc": null
    },
    {
        "name": "Gordon, Emile",
        "focus1": "Clinical",
        "focus2": null,
        "role": null,
        "modality": "Cardiothoracic Imaging",
        "degree": "MD",
        "email": "emgordon@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/emile.gordon",
        "imageSrc": null
    },
    {
        "name": "Hahn, Michael",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Director, Body Imaging Fellowship Program",
        "modality": "Body Imaging",
        "degree": "MD PhD",
        "email": "mehahn@health.ucsd.edu",
        "team": 4,
        "profileUrl": "http://profiles.ucsd.edu/michael.hahn",
        "imageSrc": null
    },
    {
        "name": "Halgren, Eric",
        "focus1": "Research",
        "focus2": null,
        "role": null,
        "modality": null,
        "degree": "PhD",
        "email": "ehalgren@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/eric.halgren",
        "imageSrc": null
    },
    {
        "name": "Hall, David",
        "focus1": "Research",
        "focus2": null,
        "role": null,
        "modality": null,
        "degree": "PhD",
        "email": "djhall@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/david.hall",
        "imageSrc": null
    },
    {
        "name": "Handwerker, Jason",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Vice Chair of Quality & Safety",
        "modality": "Neuroimaging",
        "degree": "MD",
        "email": "jhandwerker@health.ucsd.edu",
        "team": 2,
        "profileUrl": "https://providers.ucsd.edu/details/32533/radiology",
        "imageSrc": "images/faculty-images/Jason_Handwerker.webp"
    },
    {
        "name": "Hawley, Daniel",
        "focus1": "Clinical",
        "focus2": null,
        "role": "MRI Modality Chief",
        "modality": "Neuroimaging",
        "degree": "MD",
        "email": "dhawley@health.ucsd.edu",
        "team": 4,
        "profileUrl": "http://profiles.ucsd.edu/daniel.hawley",
        "imageSrc": null
    },
    {
        "name": "Hero Chung, Jonathan",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Division Chief",
        "modality": "Cardiothoracic Imaging",
        "degree": "MD",
        "email": "jherochung@health.ucsd.edu",
        "team": 3,
        "profileUrl": "http://profiles.ucsd.edu/jonathan.herochung",
        "imageSrc": null
    },
    {
        "name": "Horowitz, Michael",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Director, Cardiothoracic Imaging Fellowship Program",
        "modality": "Cardiothoracic Imaging",
        "degree": "MD PhD",
        "email": "mjhorowitz@health.ucsd.edu",
        "team": 4,
        "profileUrl": "https://profiles.ucsd.edu/michael.horowitz",
        "imageSrc": "images/faculty-images/Michael_Horowitz.webp"
    },
    {
        "name": "Hsiao, Albert",
        "focus1": "Clinical",
        "focus2": null,
        "role": null,
        "modality": "Cardiothoracic Imaging",
        "degree": "MD PhD",
        "email": "a3hsiao@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/albert.hsiao",
        "imageSrc": "images/faculty-images/Albert_Hsiao.webp"
    },
    {
        "name": "Huang, Brady",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Division Chief",
        "modality": "Musculoskeletal Imaging",
        "degree": "MD",
        "email": "b4huang@health.ucsd.edu",
        "team": 3,
        "profileUrl": "http://profiles.ucsd.edu/brady.huang",
        "imageSrc": "images/faculty-images/Brady_Huang.webp"
    },
    {
        "name": "Huang, Mingxiong",
        "focus1": "Research",
        "focus2": null,
        "role": null,
        "modality": null,
        "degree": "PhD",
        "email": "mxhuang@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/mingxiong.huang",
        "imageSrc": null
    },
    {
        "name": "Ingraham, Christopher",
        "focus1": "Clinical",
        "focus2": null,
        "role": null,
        "modality": "Interventional Radiology",
        "degree": "MD",
        "email": "cingraham@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/christopher.ingraham",
        "imageSrc": "images/faculty-images/Christopher_Ingraham.webp"
    },
    {
        "name": "Jaffray, Paul",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Division Chief, Emergency Radiology",
        "modality": "Emergency Radiology",
        "degree": "MD",
        "email": "pjaffray@health.ucsd.edu",
        "team": 3,
        "profileUrl": "https://providers.ucsd.edu/details/1336136614/radiology",
        "imageSrc": null
    },
    {
        "name": "Jerban, Saeed",
        "focus1": "Research",
        "focus2": null,
        "role": null,
        "modality": null,
        "degree": "PhD",
        "email": "sjerban@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/saeed.jerban",
        "imageSrc": null
    },
    {
        "name": "Jernigan, Terry",
        "focus1": "Research",
        "focus2": null,
        "role": null,
        "modality": null,
        "degree": "PhD",
        "email": "tjernigan@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://www.cogsci.ucsd.edu/~jernigan/",
        "imageSrc": null
    },
    {
        "name": "Khurana, Aman",
        "focus1": "Clinical",
        "focus2": null,
        "role": null,
        "modality": "Body Imaging",
        "degree": "MD MBBS",
        "email": "a1khurana@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/aman.khurana",
        "imageSrc": null
    },
    {
        "name": "Liau, Joy",
        "focus1": "Clinical",
        "focus2": null,
        "role": null,
        "modality": "Body Imaging",
        "degree": "MD PhD",
        "email": "jliau@health.ucsd.edu",
        "team": null,
        "profileUrl": "https://profiles.ucsd.edu/joy.liau",
        "imageSrc": "images/faculty-images/Joy_Liau.webp"
    },
    {
        "name": "Lim, Vivian",
        "focus1": "Clinical",
        "focus2": null,
        "role": null,
        "modality": "Body Imaging",
        "degree": "MD",
        "email": "vlim@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/vivian.lim",
        "imageSrc": "images/faculty-images/Vivian_Lim.webp"
    },
    {
        "name": "Marks, Robert",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Division Chief",
        "modality": "Body Imaging",
        "degree": "MD",
        "email": "rmarks@health.ucsd.edu",
        "team": 3,
        "profileUrl": "http://profiles.ucsd.edu/robert.marks",
        "imageSrc": "images/faculty-images/Robert_Marks.webp"
    },
    {
        "name": "Meisinger, Quinn",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Program Director, IRDR Residency Program",
        "modality": "Interventional Radiology",
        "degree": "MD",
        "email": "qmeisinger@health.ucsd.edu",
        "team": 4,
        "profileUrl": "http://profiles.ucsd.edu/quinn.meisinger",
        "imageSrc": "images/faculty-images/Quinn_Meisinger.webp"
    },
    {
        "name": "Minocha, Jeet",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Division Chief",
        "modality": "Interventional Radiology",
        "degree": "MD",
        "email": "jminocha@health.ucsd.edu",
        "team": 3,
        "profileUrl": "http://profiles.ucsd.edu/jeet.minocha",
        "imageSrc": "images/faculty-images/Jeet_Minocha.webp"
    },
    {
        "name": "Murphy, Paul",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Vice Chair of Information Technology",
        "modality": "Body Imaging",
        "degree": "MD PhD",
        "email": "pmmurphy@health.ucsd.edu",
        "team": 2,
        "profileUrl": "http://profiles.ucsd.edu/paul.murphy",
        "imageSrc": "images/faculty-images/Paul_Murphy.webp"
    },
    {
        "name": "Newton, Isabel",
        "focus1": "Clinical",
        "focus2": "Research",
        "role": null,
        "modality": "Interventional Radiology",
        "degree": "MD PhD",
        "email": "inewton@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/isabel.newton",
        "imageSrc": "images/faculty-images/Isabel_Newton.webp"
    },
    {
        "name": "Ojeda-Fournier, Haydee",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Division Chief",
        "modality": "Breast Imaging",
        "degree": "MD",
        "email": "hojeda@health.ucsd.edu",
        "team": 3,
        "profileUrl": "http://profiles.ucsd.edu/haydee.ojeda-fournier",
        "imageSrc": "images/faculty-images/Haydee_Ojeda_Fournier.webp"
    },
    {
        "name": "Parikh, Rupal",
        "focus1": "Clinical",
        "focus2": null,
        "role": null,
        "modality": "Interventional Radiology",
        "degree": "MD",
        "email": "ruparikh@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/rupal.parikh",
        "imageSrc": "images/faculty-images/Rupal_Parikh.webp"
    },
    {
        "name": "Pathria, Mini",
        "focus1": "Clinical",
        "focus2": null,
        "role": null,
        "modality": "Musculoskeletal Imaging",
        "degree": "MD",
        "email": "mpathria@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/mini.pathria",
        "imageSrc": "images/faculty-images/Mini_Pathria.webp"
    },
    {
        "name": "Pohlen, Michael",
        "focus1": "Clinical",
        "focus2": null,
        "role": null,
        "modality": "Cardiothoracic Imaging",
        "degree": "MD",
        "email": "mpohlen@health.ucsd.edu",
        "team": null,
        "profileUrl": "http://profiles.ucsd.edu/michael.pohlen",
        "imageSrc": "images/faculty-images/Michael_Pohlen.webp"
    },
    {
        "name": "Anaya, Sonia",
        "focus1": "Administration",
        "focus2": null,
        "role": "Interim Administrative Vice Chair",
        "modality": null,
        "degree": null,
        "email": "sanaya@health.ucsd.edu",
        "team": 1,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Savoie, Joseph",
        "focus1": "Administration",
        "focus2": null,
        "role": "Senior Director, Radiology",
        "modality": null,
        "degree": "MHA",
        "email": "jsavoie@health.ucsd.edu",
        "team": 1,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Utt, Whitney",
        "focus1": "Administration",
        "focus2": null,
        "role": "Interim Director, Radiology Nursing",
        "modality": null,
        "degree": "MSOL BSN CCRN",
        "email": "wutt@health.ucsd.edu",
        "team": 1,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Ramirez, Lorena",
        "focus1": "Administration",
        "focus2": null,
        "role": "Director of Radiology, La Jolla",
        "modality": null,
        "degree": null,
        "email": "L5ramirez@health.ucsd.edu",
        "team": 1,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Wendorf, Chloee",
        "focus1": "Administration",
        "focus2": null,
        "role": "Technical Director, Imaging Services",
        "modality": null,
        "degree": "MHA CNMT",
        "email": "cwendorf@health.ucsd.edu",
        "team": 1,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Vanderpool, John",
        "focus1": "Administration",
        "focus2": null,
        "role": "Radiology/Imaging Multi-Modality Manager, Hillcrest Campus",
        "modality": null,
        "degree": "MBA BS NMTCB (CNMT)(PET) RT (CT)",
        "email": "jvanderpool@health.ucsd.edu",
        "team": 1,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Lee, Edward",
        "focus1": "Administration",
        "focus2": null,
        "role": "Director of Radiology, Hillcrest",
        "modality": null,
        "degree": null,
        "email": "Ewl002@health.ucsd.edu",
        "team": 1,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Gergen, Sandra",
        "focus1": "Administration",
        "focus2": null,
        "role": "Director of Radiology/Cardiology, East Campus",
        "modality": null,
        "degree": "ARRT(R)",
        "email": "sgergen@health.ucsd.edu",
        "team": 1,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Cruz, Jeannie",
        "focus1": "Administration",
        "focus2": null,
        "role": "Interim Administrative Director of Clinical Operations",
        "modality": null,
        "degree": null,
        "email": "jcruz@health.ucsd.edu",
        "team": 1,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Hernandez, Olivia",
        "focus1": "Administration",
        "focus2": null,
        "role": "Project Coordinator & Assistant to the Chair’s Office",
        "modality": null,
        "degree": null,
        "email": "ohernandez@health.ucsd.edu",
        "team": null,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Robles, Angelica",
        "focus1": "Administration",
        "focus2": null,
        "role": "Human Resources Manager",
        "modality": null,
        "degree": null,
        "email": "arobles@health.ucsd.edu",
        "team": null,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Gonzalez, Blanca",
        "focus1": "Administration",
        "focus2": null,
        "role": "Director of Academic Affairs",
        "modality": null,
        "degree": null,
        "email": "B3gonzalez@health.ucsd.edu",
        "team": null,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Mariaca, Cristi",
        "focus1": "Administration",
        "focus2": null,
        "role": "Academic Affairs Analyst",
        "modality": null,
        "degree": null,
        "email": "cmariaca@health.ucsd.edu",
        "team": null,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Dang, Myra",
        "focus1": "Administration",
        "focus2": null,
        "role": "Fellowship & Education Coordinator",
        "modality": null,
        "degree": null,
        "email": "mndang@health.ucsd.edu",
        "team": null,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Ghobrial, Eman",
        "focus1": "Administration",
        "focus2": null,
        "role": "Information System Analyst",
        "modality": null,
        "degree": null,
        "email": "eghobrial@health.ucsd.edu",
        "team": null,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Brown, Dion",
        "focus1": "Administration",
        "focus2": null,
        "role": "Residency Program Administrator",
        "modality": null,
        "degree": null,
        "email": "dibrown@health.ucsd.edu",
        "team": null,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Garcia, Angelica",
        "focus1": "Administration",
        "focus2": null,
        "role": "Administrative Supervisor",
        "modality": null,
        "degree": null,
        "email": "aygarcia@health.ucsd.edu",
        "team": null,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Valencia-Avendano, Isaac",
        "focus1": "Administration",
        "focus2": null,
        "role": "Executive Assistant",
        "modality": null,
        "degree": null,
        "email": "ivalenciaavendano@health.ucsd.edu",
        "team": null,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Yanez, Mariana",
        "focus1": "Administration",
        "focus2": null,
        "role": "Executive Assistant",
        "modality": null,
        "degree": null,
        "email": "M4yanez@health.ucsd.edu",
        "team": null,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Keane, Audrey",
        "focus1": "Administration",
        "focus2": null,
        "role": "Executive Assistant",
        "modality": null,
        "degree": null,
        "email": "adkeane@health.ucsd.edu",
        "team": null,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Gomez, Delia",
        "focus1": "Administration",
        "focus2": null,
        "role": "Executive Assistant",
        "modality": null,
        "degree": null,
        "email": "dmunozol@health.ucsd.edu",
        "team": null,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Hernandez, Alma",
        "focus1": "Administration",
        "focus2": null,
        "role": "Financial Specialist",
        "modality": null,
        "degree": null,
        "email": "alhernandez@health.ucsd.edu",
        "team": null,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Salas, Yanira",
        "focus1": "Administration",
        "focus2": null,
        "role": "Financial Specialist",
        "modality": null,
        "degree": null,
        "email": "ysalas@health.ucsd.edu",
        "team": null,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Anaya, Sonia",
        "focus1": "Administration",
        "focus2": null,
        "role": "Interim Administrative Vice Chair",
        "modality": null,
        "degree": null,
        "email": "sanaya@health.ucsd.edu",
        "team": 1,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Savoie, Joseph",
        "focus1": "Administration",
        "focus2": null,
        "role": "Senior Director, Radiology",
        "modality": null,
        "degree": "MHA",
        "email": "jsavoie@health.ucsd.edu",
        "team": 1,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Utt, Whitney",
        "focus1": "Administration",
        "focus2": null,
        "role": "Interim Director, Radiology Nursing",
        "modality": null,
        "degree": "MSOL BSN CCRN",
        "email": "wutt@health.ucsd.edu",
        "team": 1,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Ramirez, Lorena",
        "focus1": "Administration",
        "focus2": null,
        "role": "Director of Radiology, La Jolla",
        "modality": null,
        "degree": null,
        "email": "L5ramirez@health.ucsd.edu",
        "team": 1,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Wendorf, Chloee",
        "focus1": "Administration",
        "focus2": null,
        "role": "Technical Director, Imaging Services",
        "modality": null,
        "degree": "MHA CNMT",
        "email": "cwendorf@health.ucsd.edu",
        "team": 1,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Vanderpool, John",
        "focus1": "Administration",
        "focus2": null,
        "role": "Radiology/Imaging Multi-Modality Manager, Hillcrest Campus",
        "modality": null,
        "degree": "MBA BS NMTCB (CNMT)(PET) RT (CT)",
        "email": "jvanderpool@health.ucsd.edu",
        "team": 1,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Lee, Edward",
        "focus1": "Administration",
        "focus2": null,
        "role": "Director of Radiology, Hillcrest",
        "modality": null,
        "degree": null,
        "email": "Ewl002@health.ucsd.edu",
        "team": 1,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Gergen, Sandra",
        "focus1": "Administration",
        "focus2": null,
        "role": "Director of Radiology/Cardiology, East Campus",
        "modality": null,
        "degree": "ARRT(R)",
        "email": "sgergen@health.ucsd.edu",
        "team": 1,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Cruz, Jeannie",
        "focus1": "Administration",
        "focus2": null,
        "role": "Interim Administrative Director of Clinical Operations",
        "modality": null,
        "degree": null,
        "email": "jcruz@health.ucsd.edu",
        "team": 1,
        "profileUrl": null,
        "imageSrc": null
    },
    {
        "name": "Dorros, Stephen",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Vice Chair of Business Development",
        "modality": "Musculoskeletal Imaging",
        "degree": "MD",
        "email": "sdorros@health.ucsd.edu",
        "team": 2,
        "profileUrl": "http://profiles.ucsd.edu/stephen.dorros",
        "imageSrc": null
    },
    {
        "name": "Liu, Thomas",
        "focus1": "Research",
        "focus2": null,
        "role": "Vice Chair of Research",
        "modality": null,
        "degree": "PhD MBA",
        "email": "ttliu@health.ucsd.edu",
        "team": 2,
        "profileUrl": "http://profiles.ucsd.edu/thomastao-ming.liu",
        "imageSrc": null
    },
    {
        "name": "Murphy, Paul",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Vice Chair of Information Technology",
        "modality": "Body Imaging",
        "degree": "MD PhD",
        "email": "pmmurphy@health.ucsd.edu",
        "team": 2,
        "profileUrl": "http://profiles.ucsd.edu/paul.murphy",
        "imageSrc": "images/faculty-images/Paul_Murphy.webp"
    },
    {
        "name": "Handwerker, Jason",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Vice Chair of Quality & Safety",
        "modality": "Neuroimaging",
        "degree": "MD",
        "email": "jhandwerker@health.ucsd.edu",
        "team": 2,
        "profileUrl": "https://providers.ucsd.edu/details/32533/radiology",
        "imageSrc": "images/faculty-images/Jason_Handwerker.webp"
    },
    {
        "name": "Sinha, Shantanu",
        "focus1": "Research",
        "focus2": null,
        "role": "Vice Chair of Academic Affairs",
        "modality": null,
        "degree": "PhD",
        "email": "ssinha@health.ucsd.edu",
        "team": 2,
        "profileUrl": "http://profiles.ucsd.edu/shantanu.sinha",
        "imageSrc": null
    },
    {
        "name": "Santillan, Cynthia",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Vice Chair of Clinical Operations",
        "modality": "Body Imaging",
        "degree": "MD",
        "email": "csantillan@health.ucsd.edu",
        "team": 2,
        "profileUrl": "https://providers.ucsd.edu/details/1760597632/radiology",
        "imageSrc": null
    },
    {
        "name": "Farid, Nikdokht",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Vice Chair of Education",
        "modality": "Neuroimaging",
        "degree": "MD",
        "email": "nfarid@health.ucsd.edu",
        "team": 2,
        "profileUrl": "https://providers.ucsd.edu/details/1033283702/radiology",
        "imageSrc": "images/Niky_Farid.jpg"
    },
    {
        "name": "Jaffray, Paul",
        "focus1": "Clinical",
        "focus2": null,
        "role": "Division Chief, Emergency Radiology",
        "modality": "Emergency Radiology",
        "degree": "MD",
        "email": "pjaffray@health.ucsd.edu",
        "team": 3,
        "profileUrl": "https://providers.ucsd.edu/details/1336136614/radiology",
        "imageSrc": null
    }
    // ... additional entries reformatted in the same manner ...
];

 document.addEventListener("DOMContentLoaded", function() {
        const rawFacultyData = window.facultyJson || [];
        const DEFAULT_IMG = "https://cdn.prod.website-files.com/6654eb861fcc442c666a548c/680ae7d8fa435d4844a7d9c0_Profile_avatar_placeholder_large.png";
        const ITEMS_PER_PAGE = 10;
        let currentPage = 1;
        const focusLabels = {},
          modalityLabels = {};
        let nextFocusId = 1,
          nextModalityId = 1;
        rawFacultyData.forEach(m => {
          const focusText = m.focus2 ? `${m.focus1}, ${m.focus2}` : m.focus1;
          if (focusText && !focusLabels[focusText]) focusLabels[focusText] = nextFocusId++;
          if (m.modality && !modalityLabels[m.modality]) modalityLabels[m.modality] = nextModalityId++;
        });
        const focusLookup = Object.fromEntries(Object.entries(focusLabels).map(([k, v]) => [v, k]));
        const modalityLookup = Object.fromEntries(Object.entries(modalityLabels).map(([k, v]) => [v, k]));
        const ASSIGNMENT_LABELS = {
          "Administrative Leadership": "Administrative Leadership",
          "Vice Chairs": "Vice Chairs",
          "Division Chiefs": "Division Chiefs"
        };
        // Helper to get all unique assignments (focus1/focus2)
        function getAllAssignments(data) {
          const assignments = new Set();
          data.forEach(m => {
            if (m.focus1) assignments.add(m.focus1);
            if (m.focus2) assignments.add(m.focus2);
          });
          return Array.from(assignments);
        }
        // Updated facultyData mapping (remove team, keep focus1/focus2)
        const facultyData = rawFacultyData.map(m => {
          let displayName = m.name;
          if (m.name && m.name.includes(",")) {
            const [last, first] = m.name.split(',').map(s => s.trim());
            displayName = `${first} ${last}`.replace(/,/g, "");
          }
          // Merge role and title
          let mergedRole = "";
          if (m.role && m.title) {
            mergedRole = `${m.role}, ${m.title}`;
          } else if (m.role) {
            mergedRole = m.role;
          } else if (m.title) {
            mergedRole = m.title;
          } else {
            mergedRole = "";
          }
          return {
            displayName: displayName.replace(/,/g, ""),
            degree: m.degree ? m.degree.replace(/,/g, "") : "",
            focus1: m.focus1 || null,
            focus2: m.focus2 || null,
            modality: m.modality ? modalityLabels[m.modality] : null,
            email: m.email ? m.email.replace(/\.edui$/, ".edu").replace(/@ucsd\.edu$/, "@health.ucsd.edu") : "",
            imageUrl: m.imageSrc || m.imageUrl || DEFAULT_IMG,
            profileUrl: m.profileUrl || '#',
            role: mergedRole
          };
        }).filter(f => f.displayName && f.email);
        const container = document.getElementById("faculty-results");
        const searchInput = document.getElementById("faculty-search");
        const filterPrimary = document.getElementById("filter-primary");
        const filterDivision = document.getElementById("filter-division");
        const resetButton = document.getElementById("reset-filters");
        const resultsCount = document.createElement("div"); // Create results count element
        resultsCount.id = "results-count";
        resultsCount.className = "results-count";
        resetButton.insertAdjacentElement("afterend", resultsCount); // Place it next to the reset button
        const getFocusLabel = id => focusLookup[id] || "—";
        const getModalityLabel = id => modalityLookup[id] || "—";
        function renderFacultyCards(arr) {
          container.innerHTML = "";
          const totalPages = Math.ceil(arr.length / ITEMS_PER_PAGE);
          const start = (currentPage - 1) * ITEMS_PER_PAGE;
          const end = Math.min(start + ITEMS_PER_PAGE, arr.length);
          const pageData = arr.slice(start, end);
          // Update results count
          resultsCount.textContent = `Showing ${start + 1}–${end} of ${facultyData.length} results`;
          pageData.forEach(m => {
            container.appendChild(createFacultyCard(m));
          });
          document.querySelectorAll('.pagination').forEach(pag => {
            pag.innerHTML = "";
            if (totalPages <= 1) return;
            for (let i = 1; i <= totalPages; i++) {
              const btn = document.createElement("button");
              btn.className = "page-button";
              btn.textContent = i;
              if (i === currentPage) btn.disabled = true;
              btn.addEventListener("click", () => {
                currentPage = i;
                renderFacultyCards(filteredFaculty());
                const directoryEl = document.getElementById("directory");
                if (directoryEl) {
                  directoryEl.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                  });
                }
              });
              pag.appendChild(btn);
            }
          });
        }
        // Only ONE card creation function is needed:
        function createFacultyCard(m) {
          const card = document.createElement("a");
          card.className = "profile-card faculty";
          card.href = m.profileUrl;
          card.target = "_blank";
          card.rel = "noopener noreferrer";
          const imgWrapper = document.createElement("div");
          imgWrapper.innerHTML = `<img src="${m.imageUrl}" alt="${m.displayName}" class="image-card" />`;
          card.appendChild(imgWrapper);
          const overlay = document.createElement("div");
          overlay.className = "profile-card-overlay";
          overlay.innerHTML = `
    <div class="text-size-small text-height-125">
      ${m.displayName}${m.degree ? " " + m.degree : ""}
    </div>
    <div class="text-size-tiny text-color-secondary">
      ${m.role}
    </div>
    <div class="text-size-tiny text-style-light text-height-125">
      ${getModalityLabel(m.modality)}
    </div>
    <a href="mailto:${m.email}" class="email-link" style="pointer-events: auto;">
      <div class="text-size-tiny">${m.email}</div>
    </a>
  `;
          card.appendChild(overlay);
          return card;
        }
        // Use this for all section population:
        function renderSectionByAssignment(assignment, sectionId) {
          const section = document.getElementById(sectionId);
          if (!section) return;
          section.innerHTML = ""; // Clear previous content
          // Find all faculty with this assignment in focus1 or focus2
          const group = facultyData.filter(m => m.focus1 === assignment || m.focus2 === assignment);
          group.forEach(m => {
            section.appendChild(createFacultyCard(m));
          });
        }
        // Helper: Render a section by team number
        function renderSectionByTeam(teamNumber, sectionId) {
          const section = document.getElementById(sectionId);
          if (!section) return;
          section.innerHTML = "";
          // Find all faculty with this team number
          const group = facultyData.filter(m => m.team === teamNumber);
          group.forEach(m => {
            section.appendChild(createFacultyCard(m));
          });
        }
        // Render each section by assignment and section ID
        renderSectionByAssignment("Administration", "faculty-admin");
        renderSectionByAssignment("Clinical", "faculty-vice");
        renderSectionByAssignment("Research", "faculty-division");
        // Render each section by team number and section ID
        renderSectionByTeam(1, "faculty-admin");
        renderSectionByTeam(2, "faculty-vice");
        renderSectionByTeam(3, "faculty-division");
      });