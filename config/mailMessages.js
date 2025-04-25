module.exports = {
    approved: () => ({
      subject: "Registro Aprobado",
      html: "<h1>¡Tu registro ha sido aprobado!</h1><p>Ya puedes acceder a tu cuenta y completar tu perfil profesional.</p>"
    }),
    rejected: () => ({
        subject: "Registro No Aprobado",
        html: "<h1>Tu registro no ha sido aprobado</h1><p>Lo sentimos, pero tu solicitud de registro no cumple con nuestros requisitos.</p>"
    }),
    inProcess: ({ fullname, email, ip }) => ({
        subject: 'Registro Profesional en Proceso',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h1 style="color: #f8c054; text-align: center;">Registro en proceso</h1>
            <p style="font-size: 16px;">Gracias por registrarte, <strong>${fullname}</strong>.</p>
            <p style="font-size: 16px;">Estamos procesando tu solicitud y te notificaremos cuando sea aprobada.</p>
            
            <h2 style="color: #555; border-bottom: 2px solid #ddd; padding-bottom: 5px;">Detalles del registro</h2>
            <ul style="list-style: none; padding: 0;">
            <li><strong>Nombre:</strong> ${fullname}</li>
            <li><strong>Email:</strong> ${email}</li>
            </ul>
            
            <div style="text-align: center; margin-top: 20px;">
            <img src="https://e-integra.com/global/assets/images/logo_black.png" style="max-width: 100px;" alt="Logo" />
            </div>
        </div>
        `
    }),
    adminNotification: ({ fullname, email, ip }) => ({
        subject: '¡Se solicitó un registro para ' + fullname + '!',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h1 style="color: #f8c054; text-align: center;">Nueva solicitud de registro</h1>
            <p style="font-size: 16px;">Se ha recibido una solicitud de registro de <strong>${fullname}</strong>.</p>
            <p style="font-size: 16px;">Para revisarla, ingresa al panel de administración.</p>
            
            <h2 style="color: #555; border-bottom: 2px solid #ddd; padding-bottom: 5px;">Detalles del registro</h2>
            <ul style="list-style: none; padding: 0;">
                <li><strong>Nombre:</strong> ${fullname}</li>
                <li><strong>Email:</strong> ${email}</li>
            </ul>
            
            <div style="text-align: center; margin-top: 20px;">
                <a href="https://e-integra.com/control/pending" style="background-color: #28a745; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-size: 16px;">Ingresar</a>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
                <img src="https://e-integra.com/global/assets/images/logo_black.png" style="max-width: 100px;" alt="Logo" />
            </div>
            </div>
        `
    })
  };
